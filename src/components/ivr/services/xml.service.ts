// ExoML XML builders for Exotel
// Exotel uses: <Say>, <GetDigits>, <Hangup>, <Response>

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildGather(
  text: string,
  actionUrl: string,
  numDigits = 1,
  timeout = 10
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <GetDigits action="${actionUrl}" method="POST" numDigits="${numDigits}" timeout="${timeout}" finishOnKey="">
    <Say>${escapeXml(text)}</Say>
  </GetDigits>
  <Say>We did not receive your input. Please call back. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

export function buildHangup(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(text)}</Say>
  <Hangup/>
</Response>`;
}

export function buildSay(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(text)}</Say>
</Response>`;
}
