export default async function handler(req,res){
  if(req.method!=="POST")
    return res.status(405).json({error:"Method not allowed"});

  try{
    const {message}=req.body;

    if(!message)
      return res.status(400).json({error:"Message kosong"});

    const response=await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-goog-api-key":process.env.GEMINI_API_KEY
        },
        body:JSON.stringify({
          system_instruction:{
            parts:[{
              text:"Kamu adalah NEX AI, personal AI assistant yang ramah, pintar, membantu, dan menjawab dalam bahasa yang digunakan pengguna."
            }]
          },
          contents:[
            {
              role:"user",
              parts:[
                {text:message}
              ]
            }
          ]
        })
      }
    );

    const data=await response.json();

    if(!response.ok){
      return res.status(response.status).json({
        error:data.error?.message||"Gemini API gagal"
      });
    }

    const reply=
      data.candidates?.[0]?.content?.parts?.[0]?.text;

    if(!reply){
      return res.status(500).json({
        error:"Gemini tidak memberikan jawaban."
      });
    }

    return res.status(200).json({
      reply,
      mode:"gemini"
    });

  }catch(error){
    console.error(error);

    return res.status(500).json({
      error:"Server error"
    });
  }
}
