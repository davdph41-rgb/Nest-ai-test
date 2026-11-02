export default async function handler(req,res){
  if(req.method!=="POST")
    return res.status(405).json({error:"Method not allowed"});

  try{
    const {message}=req.body;

    if(!message)
      return res.status(400).json({error:"Message kosong"});

    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
        model:"gpt-5.6",
        instructions:"Kamu adalah NEX AI, personal AI assistant yang ramah, ringkas, dan membantu.",
        input:message
      })
    });

    const data=await response.json();

    if(!response.ok)
      return res.status(response.status).json({
        error:data.error?.message||"AI request gagal"
      });

    res.status(200).json({
      reply:data.output_text
    });

  }catch(error){
    res.status(500).json({
      error:"Server error"
    });
  }
}
