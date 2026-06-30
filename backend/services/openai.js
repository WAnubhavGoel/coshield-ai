const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const getEmbedding = async (text) => {
  if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not defined. Generating mock 1536-dimension embedding.");
    const mockVector = Array.from({ length: 1536 }, () => (Math.random() * 2 - 1));
    const magnitude = Math.sqrt(mockVector.reduce((sum, val) => sum + val * val, 0));
    return mockVector.map(val => val / magnitude);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-3-small"
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result.data[0].embedding;
  } catch (error) {
    console.error("Error generating OpenAI embedding:", error.message);
    throw error;
  }
};

export const generateChatCompletion = async (systemPrompt, userPrompt) => {
  if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY is not defined. Generating mock RAG response.");
    return JSON.stringify({
      answer: "This is a mock answer synthesized by CoShield AI. To view real answers, please configure the `OPENAI_API_KEY` in your environment files. In the meantime, I have verified your RBAC access claims successfully and fetched the matching document chunks listed below.",
      citations: [
        {
          chunk_id: "example-chunk-id-1",
          relevance: "High"
        }
      ]
    }, null, 2);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI Chat Completion:", error.message);
    throw error;
  }
};
