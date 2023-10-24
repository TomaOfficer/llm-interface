import OpenAI from "openai";

const openai = new OpenAI();

const write_engagement_letter = async (input: string, runManager?: CallbackManagerForToolRun): Promise<string> => {
  try {
    // Create a completion using OpenAI's API
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful assistant specialized in generating engagement letters. Pay close attention to the details provided by the user, such as client name, address, matter, and scope of representation, to draft an appropriate engagement letter. If you don't have enough details from the user, just say so." },
        { role: "user", content: input }
      ],
      model: "gpt-4",
      temperature: 0.5, 
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

export { write_engagement_letter };
