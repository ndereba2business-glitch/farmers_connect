export async function askCluckyAI({
  question,
  memory
}) {
  const response = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer YOUR_OPENAI_API_KEY`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `
You are Clucky AI, an agricultural assistant for farmers in Africa.

Use the following farm memory:
${JSON.stringify(memory)}

Rules:
- Give practical farming advice
- Focus on poultry, livestock, and crops
- Be simple and actionable
- Consider local African farming conditions
            `
          },
          {
            role: "user",
            content: question
          }
        ]
      })
    }
  );

  const data = await response.json();

  return data.choices?.[0]?.message?.content;
}