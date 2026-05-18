import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.DATABRICKS_TOKEN!,
    baseURL: process.env.DATABRICKS_HOST_URL! + process.env.DATABRICKS_BASE_PATH!,
    dangerouslyAllowBrowser: true,
});

async function main() {
    const stream = await client.chat.completions.create({
        model: "databricks-gpt-oss-120b",
        messages: [
            { role: "system", content: "You are a helpful assistant. Be concise." },
            { role: "user", content: "Say hello in 3 words" }
        ],
        stream: true,
        max_tokens: 100,
    });

    let count = 0;
    for await (const chunk of stream) {
        count++;
        const choice = chunk.choices?.[0];
        if (choice?.delta) {
            const content = choice.delta.content;
            // Show content detail
            if (content === undefined) {
                console.error(`CHUNK ${count}: (no content)`);
            } else if (typeof content === "string") {
                console.error(`CHUNK ${count}: string="${content}"`);
            } else if (Array.isArray(content)) {
                for (const part of content) {
                    console.error(`CHUNK ${count}: part type=${part.type} text=${JSON.stringify((part as any).text || (part as any).summary?.[0]?.text || "")}`);
                }
            }
        }
    }
    console.error("Total chunks:", count);
}
main().catch(console.error);
