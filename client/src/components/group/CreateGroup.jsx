import { useState } from "react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import api from "../../lib/axios";
import { useChatStore } from "../../store/chatStore";

export default function CreateGroup({ open, onClose }) {
  const [name, setName] = useState("");
  const [memberIds, setMemberIds] = useState("");
  const { loadConversations } = useChatStore();

  const submit = async (e) => {
    e.preventDefault();

    await api.post("/conversations/group", {
      name,
      memberIds: memberIds
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    });

    await loadConversations();
    onClose();
    setName("");
    setMemberIds("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Create group">
      <form onSubmit={submit} className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Group name"
          className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70"
        />
        <textarea
          value={memberIds}
          onChange={(e) => setMemberIds(e.target.value)}
          placeholder="Member IDs comma separated"
          className="w-full rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70"
        />
        <Button type="submit" className="w-full">
          Create
        </Button>
      </form>
    </Modal>
  );
}
