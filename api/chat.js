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
          input:message,
          generation_config:{
            thinking_level:"low"
          }
        })
      }
    );

    const data=await response.json();

    console.log("Gemini response:",JSON.stringify(data));

    if(!response.ok){
      return res.status(response.status).json({
        error:data.error?.message||"Gemini API gagal"
      });
    }

    const reply=data.output_text;

    if(!reply){
      return res.status(500).json({
        error:"Gemini tidak menghasilkan teks."
      });
    }

    return res.status(200).json({
      reply:reply,
      mode:"gemini"
    });

  }catch(error){
    console.error("SERVER ERROR:",error);

    return res.status(500).json({
      error:error.message||"Server error"
    });
  }
}
