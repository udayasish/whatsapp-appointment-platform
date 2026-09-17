# Follow-Up Technical Investigation: Dynamic Gather JSON Returning 200 OK (<1ms) but Audio is Silent

## 1. Context & What Was Implemented Based on Recommendations

We implemented all the recommended fixes on our backend:
1. **Explicit `HEAD` Handlers:**
   Implemented zero-latency `HEAD` routes on `/api/ivr/prompt` and `/api/ivr/prompt/fallback` returning `200 OK` with `Content-Type: application/json; charset=utf-8`.
2. **Explicit `finish_on_key: ""`:**
   Passed `"finish_on_key": ""` to prevent Exotel's default `#` terminator conflict with `max_input_digits: 1`.
3. **Strict Integer Types:**
   Enforced strict numbers: `"max_input_digits": 1`, `"input_timeout": 10`.
4. **Added Dynamic Fallback URL:**
   Configured in Exotel Flow Builder:
   - **Primary URL:** `https://...ngrok-free.dev/api/ivr/prompt`
   - **Fallback URL:** `https://...ngrok-free.dev/api/ivr/prompt/fallback`

---

## 2. Live Test Logs & Observations

During our live test call, here is the exact log trace from our backend:

```text
[2026-09-17 13:05:53] [info]: IVR handlePrompt received
{
  "CallSid": "d7f1b36398a14f760db14e4d23101a9h",
  "From": "07002059544",
  "To": "09513886363",
  "CallStatus": "in-progress",
  "Direction": "incoming"
}

[2026-09-17 13:05:57] [info]: IVR handlePrompt sending dynamic JSON to Exotel Gather
{
  "callSid": "d7f1b36398a14f760db14e4d23101a9h",
  "promptText": "Namaste! Welcome to Demo Clinic. Press 1 to book an appointment. Press 0 to exit."
}

[2026-09-17 13:05:58] [warn]: IVR handlePromptFallback called by Exotel
```

### What Happened During the Request:
1. The Primary URL took ~4 seconds to reply (due to database latency across regions).
2. Exotel's gateway timer triggered and Exotel **correctly fell back to `/api/ivr/prompt/fallback`** at `13:05:58`.
3. The Fallback endpoint returned in **under 1 millisecond** with `HTTP 200 OK` and:
   ```http
   HTTP/1.1 200 OK
   Content-Type: application/json; charset=utf-8

   {
     "gather_prompt": {
       "text": "Namaste! Welcome to Demo Clinic. Press 1 to book an appointment. Press 0 to exit."
     },
     "max_input_digits": 1,
     "finish_on_key": "",
     "input_timeout": 10
   }
   ```

### What Happened on the Caller's Phone:
- **STILL COMPLETE SILENCE.**
- Despite Exotel successfully fetching the fallback JSON in `< 1ms` with `200 OK`, valid headers, explicit `HEAD` support, strict integers, and `"finish_on_key": ""`, **no audio was spoken to the caller**.
- The call remained silent for the 10-second timeout period and then terminated.

### The Contrast:
- In the exact same call flow on the exact same trial number, if the Gather applet is switched to **"Configure using flow builder here"** with the exact same text typed into the UI, **the TTS audio speaks loud, clear, and immediately**.

---

## 3. Targeted Questions for Deep Resolution

1. **Does Exotel's Dynamic Gather Applet genuinely support Text-to-Speech (`"text": "..."`) on Indian numbers / trial accounts?**
   - Is dynamic text-to-speech disabled by default on Exotel accounts unless a specific TTS add-on (e.g. Amazon Polly integration) is provisioned?
   - Or does dynamic Gather **strictly require an `audio_url`** (e.g., `https://.../audio.wav` or `.mp3`) rather than `"text"`?
2. **Is there an undocumented wrapping or format requirement in the JSON?**
   - For example: does `gather_prompt` need to be a raw string:
     `{ "gather_prompt": "Namaste...", "max_input_digits": 1 }`
     or does it require an explicit language/voice key (e.g., `"lang": "en-IN"`)?
3. **If dynamic JSON TTS is not supported or broken on trial accounts:**
   - Can we serve dynamic audio on the fly by generating an MP3/WAV endpoint (e.g., using Node's `@google-cloud/text-to-speech` or an internal TTS stream) and returning `{ "gather_prompt": { "audio_url": "https://.../api/ivr/tts.mp3" } }`?
   - Or how can we invoke an ExoML flow from within Flow Builder?
