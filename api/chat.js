export default async function handler(req,res){
  if(req.method!=="POST")
    return res.status(405).json({error:"Method not allowed"});

  try{
    const {message}=req.body;

    if(!message)
      return res.status(400).json({error:"Message kosong"});

    const response=await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-goog-api-key":process.env.GEMINI_API_KEY
        },
        body:JSON.stringify({
          model:"gemini-3.8-flash",
          input:message
        })
      }
    );

    const data=await response.json();

    if(!response.ok){
      console.error("Gemini error:",data);

      return res.status(response.status).json({
        error:data.error?.message||"Gemini API gagal"
      });
    }

    const steps=data.steps||[];

    const textStep=steps
      .slice()
      .reverse()
      .find(step=>step.type==="model_output");

    const reply=textStep?.content
      ?.find(item=>item.type==="text")
      ?.text;

    if(!reply){
      return res.status(500).json({
        error:"Gemini belum memberikan jawaban."
      });
    }

    return res.status(200).json({
      reply,
      mode:"gemini"
    });

  }catch(error){
    console.error("Server error:",error);

    return res.status(500).json({
      error:"Server error"
    });
  }
}
