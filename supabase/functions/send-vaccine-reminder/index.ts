import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  const {
    phone,
    batchName,
    vaccinationDate
  } = await req.json();

  const response = await fetch(
    "https://api.africastalking.com/version1/messaging",
    {
      method: "POST",

      headers: {
        apiKey: Deno.env.get(
          "AFRICASTALKING_API_KEY"
        ) || "",

        "Content-Type":
          "application/x-www-form-urlencoded",

        Accept: "application/json"
      },

      body: new URLSearchParams({
        username: "sandbox",
        to: phone,
        message:
          `🐔 Farmers Connect Reminder:\n` +
          `${batchName} vaccination is due on ${vaccinationDate}`
      })
    }
  );

  const data = await response.json();

  return new Response(
    JSON.stringify(data),
    {
      headers: {
        "Content-Type":
          "application/json"
      }
    }
  );
});