import { env } from "../lib/env.js";

async function main() {
  const { EXOTEL_ACCOUNT_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN } = env;

  if (!EXOTEL_ACCOUNT_SID || !EXOTEL_API_KEY || !EXOTEL_API_TOKEN) {
    console.error("Missing Exotel credentials in environment.");
    process.exit(1);
  }

  const authHeader =
    "Basic " +
    Buffer.from(`${EXOTEL_API_KEY}:${EXOTEL_API_TOKEN}`).toString("base64");

  console.log(`Checking Exotel numbers for Account: ${EXOTEL_ACCOUNT_SID}`);

  const endpoints = [
    `https://api.exotel.com/v1/Accounts/${EXOTEL_ACCOUNT_SID}/IncomingPhoneNumbers.json`,
    `https://api.exotel.com/v2_beta/Accounts/${EXOTEL_ACCOUNT_SID}/IncomingPhoneNumbers`,
  ];

  for (const url of endpoints) {
    console.log(`\n--- Querying: ${url} ---`);
    try {
      const resp = await fetch(url, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      });

      console.log(`Status: ${resp.status} ${resp.statusText}`);
      const text = await resp.text();
      try {
        const json = JSON.parse(text);
        console.log("Response:", JSON.stringify(json, null, 2));
      } catch {
        console.log("Response Text (truncated):", text.slice(0, 500));
      }
    } catch (err: any) {
      console.error("Fetch error:", err.message);
    }
  }
}

main().catch(console.error);
