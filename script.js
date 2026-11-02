const chat=document.getElementById("chat");
const form=document.getElementById("chatForm");
const input=document.getElementById("message");
const clearBtn=document.getElementById("clearBtn");

function addMessage(text,type){
  const box=document.createElement("div");
  box.className=`message ${type}`;

  const bubble=document.createElement("div");
  bubble.className="bubble";
  bubble.textContent=text;

  box.appendChild(bubble);
  chat.appendChild(box);
  chat.scrollTop=chat.scrollHeight;
}

function showTyping(){
  const box=document.createElement("div");
  box.className="message ai";
  box.id="typing";
  box.innerHTML=`
    <div class="bubble">
      <div class="typing">
        <i></i><i></i><i></i>
      </div>
    </div>`;
  chat.appendChild(box);
  chat.scrollTop=chat.scrollHeight;
}

function removeTyping(){
  document.getElementById("typing")?.remove();
}

async function sendToAI(text){
  try{
    const response=await fetch("/api/chat",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        message:text
      })
    });

    const data=await response.json();

    removeTyping();

    if(!response.ok){
      addMessage(
        "Maaf, terjadi kesalahan:\n"+(data.error||"Unknown error"),
        "ai"
      );
      return;
    }

    addMessage(
      data.reply||"AI tidak memberikan jawaban.",
      "ai"
    );

  }catch(error){
    removeTyping();

    addMessage(
      "Tidak dapat terhubung ke server. Periksa koneksi atau backend.",
      "ai"
    );

    console.error(error);
  }
}

form.addEventListener("submit",async e=>{
  e.preventDefault();

  const text=input.value.trim();

  if(!text)return;

  addMessage(text,"user");

  input.value="";
  input.style.height="auto";

  showTyping();

  await sendToAI(text);
});

input.addEventListener("input",()=>{
  input.style.height="auto";
  input.style.height=Math.min(input.scrollHeight,120)+"px";
});

input.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});

clearBtn.addEventListener("click",()=>{
  location.reload();
});

document.querySelectorAll(".suggestions button").forEach(button=>{
  button.addEventListener("click",()=>{
    const text=button.textContent.replace(/^.\s*/,"").trim();

    input.value=text;
    input.focus();
    form.requestSubmit();
  });
});
