"use client";

import { ApiClient } from "@/api";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserAuthForm } from "@/components/UserAuthForm";

type AuthModalProps = {
  client: ApiClient;
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
};

export function AuthModal({ client, open, onClose, onAuthenticated }: AuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>使用邮箱继续</DialogTitle>
          <DialogDescription>登录或创建一个写作账号。</DialogDescription>
        </DialogHeader>
        <UserAuthForm
          client={client}
          onAuthenticated={() => {
            onAuthenticated();
            onClose();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
