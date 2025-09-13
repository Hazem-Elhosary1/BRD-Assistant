import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "أهلاً! ارفع الـBRD أو ابعتلي نص وانا هساعدك." },
  ]);
  const [input, setInput] = useState("");

  async function sendMessage() {
    const res = await fetch("http://localhost:5000/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });
    const data = await res.json();
    setMessages([...messages, { role: "user", content: input }, { role: "assistant", content: data.reply }]);
    setInput("");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <h1 className="text-2xl font-bold mb-4">BRD Assistant</h1>
      <div className="w-full max-w-2xl bg-white rounded-lg shadow p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`p-2 rounded ${m.role === "assistant" ? "bg-gray-100" : "bg-blue-100 text-right"}`}>
            {m.content}
          </div>
        ))}
      </div>
      <div className="flex w-full max-w-2xl mt-4">
        <input
          className="flex-1 border rounded-l-lg p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اكتب رسالتك هنا..."
        />
        <button onClick={sendMessage} className="bg-blue-600 text-white px-4 rounded-r-lg">
          Send
        </button>
      </div>
    </div>
  );
}
