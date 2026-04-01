"use client";

export function UIPanelInbox() {
  const items = [
    {
      id: "ENG-135",
      title: "Refactor sonic crawler",
      author: "nan",
      time: "2h",
      avatar: "https://i.pravatar.cc/32?img=1",
      status: "in-progress",
    },
    {
      id: "LLM",
      title: "LLM Chatbot",
      subtitle: "New project update by raissa",
      author: "",
      time: "1d",
      avatar: "https://i.pravatar.cc/32?img=2",
      status: "todo",
      isProject: true,
    },
    {
      id: "ENG-159",
      title: "Error uploading images via API",
      subtitle: "SLA breached",
      author: "",
      time: "2d",
      avatar: "https://i.pravatar.cc/32?img=3",
      status: "bug",
    },
    {
      id: "DES-498",
      title: "Redesign users settings...",
      subtitle: "karri mentioned you",
      author: "",
      time: "4h",
      avatar: "https://i.pravatar.cc/32?img=4",
      status: "todo",
    },
    {
      id: "ENG-160",
      title: "Holtzmann engine is broken",
      subtitle: "You asked to be reminded about this issue",
      author: "",
      time: "1w",
      avatar: "https://i.pravatar.cc/32?img=5",
      status: "bug",
    },
    {
      id: "",
      title: "Sign up flow experiments",
      subtitle: "Added as a project member by edgar",
      author: "",
      time: "",
      avatar: "https://i.pravatar.cc/32?img=6",
      status: "done",
      isProject: true,
    },
    {
      id: "MKT-122",
      title: "Design assets for marketing...",
      subtitle: "erin marked as Duplicate",
      author: "",
      time: "1w",
      avatar: "https://i.pravatar.cc/32?img=7",
      status: "done",
    },
    {
      id: "",
      title: "Homepage v3",
      subtitle: "New project update by paco",
      author: "",
      time: "",
      avatar: "https://i.pravatar.cc/32?img=8",
      status: "todo",
      isProject: true,
    },
  ];

  return (
    <div className="w-[300px] h-[580px] bg-zinc-900/95 backdrop-blur rounded-xl border border-zinc-800/80 shadow-2xl shadow-black/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800/80">
        <h3 className="text-white font-medium text-[15px]">Inbox</h3>
      </div>

      {/* List */}
      <div className="divide-y divide-zinc-800/30">
        {items.map((item, index) => (
          <div
            key={index}
            className="px-4 py-2.5 hover:bg-zinc-800/30 transition-colors cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <img
                src={item.avatar || "/placeholder.svg"}
                alt=""
                className="w-8 h-8 rounded-full shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {item.id && <span className="text-zinc-500 text-[11px]">{item.id}</span>}
                  {item.isProject && <span className="text-violet-400 text-[11px]">Project</span>}
                  <StatusDot status={item.status} />
                </div>
                <p className="text-white text-[13px] truncate leading-tight">{item.title}</p>
                {item.subtitle ? (
                  <p className="text-zinc-500 text-[11px] mt-0.5 truncate">{item.subtitle}</p>
                ) : item.author ? (
                  <p className="text-zinc-500 text-[11px] mt-0.5">{item.author} assigned you</p>
                ) : null}
              </div>
              {item.time && <span className="text-zinc-600 text-[11px] shrink-0">{item.time}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "in-progress": "bg-yellow-500",
    todo: "bg-zinc-600",
    bug: "bg-red-500",
    done: "bg-emerald-500",
  };

  return <div className={`w-2 h-2 rounded-full ${colors[status] || "bg-zinc-500"}`} />;
}
