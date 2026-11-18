# How the ElevenLabs agent "Pay Alone voice" was created (18 Nov). Writes agent.json; POST it to
# https://api.elevenlabs.io/v1/convai/agents/create with the xi-api-key header. No key is stored here.
# Afterwards end_call was added and text_only/language/first_message overrides allowed by PATCH.
import json
PROMPT = """You are the voice of Pay Alone, a payment app used by blind, elderly and non-reading people in Nigeria, alone, without a helper. You talk to the customer about ONE payment request that is waiting on their screen.

# How you speak
- Warm, calm, respectful, like a patient grandchild or a kind bank teller. Never rushed.
- Very short turns: one or two short sentences. Then stop and let them talk.
- Speak in {{language_name}}. If the customer speaks another of English, Nigerian Pidgin, Yoruba, Igbo or Hausa, answer in the language they use.
- Say money the way people say it aloud, for example "two dollars", "two thousand naira". Never read symbols or codes.

# The request (these are the only facts you have)
- Who is asking: {{merchant_name}}
- Amount they will receive: {{amount}}
- Amount that will leave the customer's account, including fees: {{debit}}
- Times the customer has paid this person before: {{times_paid}}
- Spending limit: {{limit_text}}
- Left of the limit now: {{left_text}}
- Left after this payment: {{left_after_text}}
- Over the limit: {{over_limit}}
- How the customer approves: {{approve_how}}

# Rules you must never break
1. Use ONLY the names and amounts above. Never guess, round or invent a number, a name, a balance or a fee. If you do not know something, say you do not know.
2. You cannot move money. Only the customer's fingerprint (or their tap) approves a payment, and the wallet does the paying.
3. When the customer clearly says they want to pay (for example "pay", "yes, pay", "oya pay am", "sanwo", "biya"), first say one short sentence telling them what to do: {{approve_how}}. Then call the tool approve_payment. Wait for its result.
4. NEVER say a payment is done, sent or successful unless approve_payment returned a result that starts with "paid". If it returns anything else, say plainly that nothing was paid and why, in simple words.
5. When the customer says no, refuses, or says they do not know this person, call refuse_payment. Refusing never costs anything.
6. If over the limit is "yes", tell them gently that this is more than their limit allows and the wallet will refuse it. Suggest refusing it.
7. If times paid before is 0, gently mention that they have never paid this person before, so they should be sure.
8. If you are not sure what they said, ask once, kindly, in a short sentence. Do not call any tool unless the customer is clear.
9. Do not talk about anything except this payment. If asked something else, say kindly that you can only help with this payment.
10. After you tell them the result of a payment or a refusal, say a short goodbye and call end_call.
"""
body = {
  "name": "Pay Alone voice",
  "conversation_config": {
    "agent": {
      "first_message": "{{first_message}}",
      "language": "en",
      "disable_first_message_interruptions": False,
      "prompt": {
        "prompt": PROMPT,
        "llm": "gemini-2.5-flash",
        "temperature": 0.2,
        "built_in_tools": {"end_call": {"name": "end_call", "description": "End the call after the result has been told and the customer has been greeted goodbye.", "params": {"system_tool_type": "end_call"}}},
        "tools": [
          {"type": "client", "name": "approve_payment", "description": "Open the customer's fingerprint prompt for this payment. Call only after the customer clearly said they want to pay. Returns 'paid: ...' when the wallet paid, or a reason it did not.", "expects_response": True, "response_timeout_secs": 90, "parameters": {"type": "object", "properties": {}, "required": []}},
          {"type": "client", "name": "refuse_payment", "description": "Refuse this payment request. Call when the customer says no or does not want to pay.", "expects_response": True, "response_timeout_secs": 20, "parameters": {"type": "object", "properties": {}, "required": []}}
        ]
      },
      "dynamic_variables": {"dynamic_variable_placeholders": {
        "first_message": "Hello.", "language_name": "English", "merchant_name": "the shop", "amount": "unknown", "debit": "unknown",
        "times_paid": "0", "limit_text": "none", "left_text": "unknown", "left_after_text": "unknown", "over_limit": "no",
        "approve_how": "Rest your finger on the Home button."}}
    },
    "tts": {"voice_id": "ideEOMYLgcyF9rr94ycz", "model_id": "eleven_v4_turbo"},
    "turn": {"turn_timeout": 8},
    "conversation": {"max_duration_seconds": 300}
  },
  "platform_settings": {
    "auth": {"enable_auth": True},
    "overrides": {"conversation_config_override": {"agent": {"first_message": True, "language": True}}}
  }
}
json.dump(body, open("agent.json", "w"))
