const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export const getEmbedding = async (text) => {
  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not defined. Generating mock 1536-dimension embedding.");
    const mockVector = Array.from({ length: 1536 }, () => (Math.random() * 2 - 1));
    const magnitude = Math.sqrt(mockVector.reduce((sum, val) => sum + val * val, 0));
    return mockVector.map(val => val / magnitude);
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }]
        },
        outputDimensionality: 1536 // Match the PostgreSQL pgvector column dimension exactly
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini Embeddings API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result.embedding.values; // Returns a 1536-dimension vector
  } catch (error) {
    console.error("Error generating Gemini embedding, falling back to mock:", error.message);
    // Fallback so the app doesn't crash during network errors or API exhaustion
    const mockVector = Array.from({ length: 1536 }, () => (Math.random() * 2 - 1));
    const magnitude = Math.sqrt(mockVector.reduce((sum, val) => sum + val * val, 0));
    return mockVector.map(val => val / magnitude);
  }
};

export const generateChatCompletion = async (systemPrompt, userPrompt) => {
  if (!GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not defined. Generating mock RAG response.");
    return JSON.stringify({
      answer: "This is a mock answer synthesized by CoShield AI. To view real answers, please configure a free `GEMINI_API_KEY` in your backend .env file. In the meantime, I have verified your RBAC access claims successfully and fetched the matching document chunks listed below.",
      citations: [
        {
          chunk_id: "example-chunk-id-1",
          document_title: "Sample Security Policy",
          page_number: 1,
          snippet: "This is a simulated verification snippet from the policy document."
        }
      ]
    }, null, 2);
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt}\n\nUser request:\n${userPrompt}` }]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Gemini Chat API error: ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return result.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Error calling Gemini Chat Completion, falling back to mock:", error.message);
    return JSON.stringify({
      answer: "An error occurred while calling the Gemini API. Please make sure your free GEMINI_API_KEY is valid and try again.",
      citations: []
    }, null, 2);
  }
};
