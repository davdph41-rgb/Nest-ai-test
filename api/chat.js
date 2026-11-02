import { GoogleGenAI } from "@google/genai";

export default async function handler(req,res){
  if(req.method!=="POST")
    return res.status(405).json({error:"Method not allowed"});

  try{
    const {message}=req.body;

    if(!message)
      return res.status(400).json({error:"Message kosong"});

    const ai=new GoogleGenAI({
      apiKey:process.env.GEMINI_API_KEY
    });

    const interaction=await ai.interactions.create({
      model:"gemini-3.8-flash",
      input:message,
      system_instruction:
        "Kamu adalah NEX AI, personal AI assistant yang ramah, pintar, membantu, dan menjawab dalam bahasa yang digunakan pengguna."
    });

    return res.status(200).json({
      reply:interaction.output_text,
      mode:"gemini"
    });

  }catch(error){
    console.error("Gemini error:",error);

    return res.status(500).json({
      error:error.message||"Gemini API gagal"
    });
  }
}
