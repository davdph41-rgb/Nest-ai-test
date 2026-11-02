const chat=document.getElementById("chat");
const form=document.getElementById("chatForm");
const input=document.getElementById("message");
const clearBtn=document.getElementById("clearBtn");
const suggestions=document.querySelectorAll(".suggestions button");

function addMessage(text,type){
  const box=document.createElement("div");
  box.className=`message ${type}`;
  box.innerHTML=`<div class="bubble">${text}</div>`;
  chat.appendChild(box);
  chat.scrollTop=chat.scrollHeight;
}

function typing(){
  const box=document.createElement("div");
  box.className="message ai";
  box.id="typing";
  box.innerHTML='<div class="bubble"><div class="typing"><i></i><i></i><i></i></div></div>';
  chat.appendChild(box);
  chat.scrollTop=chat.scrollHeight;
}

form.addEventListener("submit",e=>{
  e.preventDefault();
  const text=input.value.trim();
  if(!text)return;
  addMessage(text,"user");
  input.value="";
  typing();

  setTimeout(()=>{
    document.getElementById("typing")?.remove();
    addMessage("Aku siap membantu. Pada V2 nanti, pesan ini akan langsung diproses oleh AI.","ai");
  },800);
});

suggestions.forEach(btn=>{
  btn.onclick=()=>{
    input.value=btn.textContent.replace(/^.+? /,"");
    form.requestSubmit();
  };
});

clearBtn.onclick=()=>{
  chat.innerHTML=`<div class="welcome">
  <div class="big-logo">N</div>
  <h2>How can I help?</h2>
  <p>Ask me anything.</p>
  <div class="suggestions">
    <button>💡 Beri aku ide project</button>
    <button>📝 Buatkan task untuk hari ini</button>
    <button>💻 Bantu aku coding</button>
  </div>
  </div>`;
  location.reload();
};

input.addEventListener("input",()=>{
  input.style.height="auto";
  input.style.height=input.scrollHeight+"px";
});