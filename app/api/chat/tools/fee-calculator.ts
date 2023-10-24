import OpenAI from "openai";

const openai = new OpenAI();

const calculate_fees = async (input: string, runManager?: CallbackManagerForToolRun): Promise<string> => {
  try {
    // Create a completion using OpenAI's API
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a law firm senior executive who knows exactly how to estimate the legal fees associated with a collection of docket entries. You know that the law firm currently charges at least $1200 per hour." },
        { role: "user", content: input }
      ],
      model: "gpt-4",
      temperature: 0.01, 
      max_tokens: 2800    
    });
  
    // Extract the assistant's message and return it
    const assistantMessage = completion.choices[0].message.content;
    if (assistantMessage !== null) {
      return assistantMessage;
    } else {
      return "I couldn't generate a response.";
    }
  } catch (error) {
    // Handle any errors here
    console.error("An error occurred:", error);
    return "An error occurred while processing your request.";
  }
};

export { calculate_fees };
