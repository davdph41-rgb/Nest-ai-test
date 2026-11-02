export default async function handler(req,res){
  if(req.method!=="POST")
    return res.status(405).json({error:"Method not allowed"});

  try{
    const {message}=req.body;

    if(!message)
      return res.status(400).json({error:"Message kosong"});

    const text=message.toLowerCase();
    let reply="Aku masih dalam mode gratis. Untuk saat ini aku belum terhubung ke AI eksternal.";

    if(text.includes("halo")||text.includes("hai")||text.includes("hello"))
      reply="Halo! 👋 Aku NEX AI. Ada yang ingin kamu kerjakan?";

    else if(text.includes("nama"))
      reply="Namaku NEX AI, personal assistant yang sedang kamu bangun.";

    else if(text.includes("project")||text.includes("proyek"))
      reply="Kita bisa membuat banyak project seperti aplikasi kasir, portfolio, notes, task manager, atau tools Android berbasis HTML, CSS, dan JavaScript.";

    else if(text.includes("coding")||text.includes("kode"))
      reply="Siap membantu coding. Kirim kode atau jelaskan fitur yang ingin kamu buat.";

    else if(text.includes("terima kasih")||text.includes("makasih"))
      reply="Sama-sama! 😎";

    else if(text.includes("siapa kamu"))
      reply="Aku NEX AI — assistant yang sedang kamu bangun sendiri.";

    return res.status(200).json({
      reply,
      mode:"free"
    });

  }catch(error){
    console.error(error);

    return res.status(500).json({
      error:"Server error"
    });
  }
}
