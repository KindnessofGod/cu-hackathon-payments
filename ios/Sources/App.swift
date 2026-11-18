// Pay Alone for iPad: a native shell around https://pay-alone.vercel.app/wallet.
//
// Why native: a website must go through Apple's passkey sheet before every fingerprint. Here the app
// keeps a P-256 key in the iPad's Secure Enclave that can only be used after Touch ID, so each payment
// shows Apple's ordinary Touch ID prompt. The key signs that payment's approval challenge and the
// server checks the signature (src/lib/devicekey.ts). The fingerprint itself never leaves the iPad.
import LocalAuthentication
import Security
import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = WebViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class WebViewController: UIViewController, WKScriptMessageHandlerWithReply, WKNavigationDelegate, WKUIDelegate {
    private static let startURL = URL(string: "https://pay-alone.vercel.app/wallet")!
    private static let keyTag = Data("app.payalone.devicekey".utf8)
    private var webView: WKWebView!

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = [] // the request can be read aloud as soon as it arrives
        config.applicationNameForUserAgent = "PayAloneApp/1.0"
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "payalone")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView.load(URLRequest(url: Self.startURL))
    }

    // MARK: bridge from the web page

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else {
            replyHandler(nil, "bad message")
            return
        }
        switch action {
        case "createKey":
            do { replyHandler(try createKey(), nil) } catch { replyHandler(nil, error.localizedDescription) }
        case "sign":
            guard let challenge = body["challenge"] as? String else {
                replyHandler(nil, "missing challenge")
                return
            }
            let reason = (body["reason"] as? String) ?? "Approve this payment"
            DispatchQueue.global(qos: .userInitiated).async {
                let result = Result { try self.sign(challenge, reason: reason) }
                DispatchQueue.main.async {
                    switch result {
                    case .success(let signature): replyHandler(signature, nil)
                    case .failure(let error): replyHandler(nil, error.localizedDescription)
                    }
                }
            }
        default:
            replyHandler(nil, "unknown action")
        }
    }

    // MARK: Secure Enclave key

    private func deleteKey() {
        let query: [String: Any] = [kSecClass as String: kSecClassKey, kSecAttrApplicationTag as String: Self.keyTag]
        SecItemDelete(query as CFDictionary)
    }

    /// Makes a new key that only works after Touch ID with a currently enrolled finger. Returns the public key, base64 X9.63.
    private func createKey() throws -> String {
        deleteKey()
        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(kCFAllocatorDefault, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, [.privateKeyUsage, .biometryCurrentSet], &error) else {
            throw error!.takeRetainedValue() as Error
        }
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: Self.keyTag,
                kSecAttrAccessControl as String: access,
            ] as [String: Any],
        ]
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw error!.takeRetainedValue() as Error
        }
        guard let publicKey = SecKeyCopyPublicKey(privateKey), let data = SecKeyCopyExternalRepresentation(publicKey, &error) as Data? else {
            throw NSError(domain: "PayAlone", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not read the public key"])
        }
        return data.base64EncodedString()
    }

    /// Shows the Touch ID prompt, then signs the text. Returns a base64 DER ECDSA signature.
    private func sign(_ text: String, reason: String) throws -> String {
        let context = LAContext()
        context.localizedReason = reason
        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: Self.keyTag,
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecReturnRef as String: true,
            kSecUseAuthenticationContext as String: context,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let found = item else {
            throw NSError(domain: "PayAlone", code: 1, userInfo: [NSLocalizedDescriptionKey: "No fingerprint key on this iPad"])
        }
        let key = found as! SecKey // swiftlint:disable:this force_cast
        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(key, .ecdsaSignatureMessageX962SHA256, Data(text.utf8) as CFData, &error) as Data? else {
            throw error!.takeRetainedValue() as Error
        }
        return signature.base64EncodedString()
    }

    // MARK: web view behaviour

    /// Links that open a new window (target=_blank) load in the same view.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
        return nil
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    /// Microphone (spoken "pay" or "no") and camera (scanning a pay code), for our own site only.
    /// iPadOS still asks the person once, using the descriptions in Info.plist; after that the page
    /// does not ask again on every launch, which a blind user could not easily answer.
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == Self.startURL.host ? .grant : .deny)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { showOffline(error) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { showOffline(error) }

    private func showOffline(_ error: Error) {
        let nsError = error as NSError
        if nsError.code == NSURLErrorCancelled { return }
        let alert = UIAlertController(title: "No connection", message: "Pay Alone could not reach the internet. \(error.localizedDescription)", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Try again", style: .default) { _ in self.webView.load(URLRequest(url: Self.startURL)) })
        present(alert, animated: true)
    }
}
