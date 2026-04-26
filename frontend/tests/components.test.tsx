import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiClient, ChatReference } from "../src/api";
import { AuthModal } from "../src/components/AuthModal";
import { ChatMentionInput, type ChatMentionInputHandle } from "../src/components/ChatMentionInput";
import { useIsMobile } from "../src/hooks/use-mobile";

function authClient(loginWithEmail: ApiClient["loginWithEmail"]): ApiClient {
  return { loginWithEmail } as ApiClient;
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("AuthModal", () => {
  it("validates email before calling the API", async () => {
    const user = userEvent.setup();
    const loginWithEmail = vi.fn<ApiClient["loginWithEmail"]>();
    render(<AuthModal client={authClient(loginWithEmail)} open onClose={vi.fn()} onAuthenticated={vi.fn()} />);

    await user.clear(screen.getByLabelText("邮箱"));
    await user.type(screen.getByLabelText("邮箱"), "writer");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("请输入有效邮箱")).toBeVisible();
    expect(loginWithEmail).not.toHaveBeenCalled();
  });

  it("closes after successful login", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onAuthenticated = vi.fn();
    const loginWithEmail = vi.fn<ApiClient["loginWithEmail"]>().mockResolvedValue({
      id: "u1",
      email: "writer@example.com",
      nickname: "writer",
      role: "user",
      status: "active"
    });
    render(<AuthModal client={authClient(loginWithEmail)} open onClose={onClose} onAuthenticated={onAuthenticated} />);

    await user.clear(screen.getByLabelText("邮箱"));
    await user.type(screen.getByLabelText("邮箱"), "writer@example.com");
    await user.clear(screen.getByLabelText("密码"));
    await user.type(screen.getByLabelText("密码"), "secret123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    expect(window.localStorage.getItem("jfxz-user-token")).toBeNull();
    expect(onClose).toHaveBeenCalled();
    expect(loginWithEmail).toHaveBeenCalledWith("writer@example.com", "secret123");
  });

  it("shows API failures without closing the modal", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const loginWithEmail = vi.fn<ApiClient["loginWithEmail"]>().mockRejectedValue(new Error("disabled"));
    render(<AuthModal client={authClient(loginWithEmail)} open onClose={onClose} onAuthenticated={vi.fn()} />);

    await user.type(screen.getByLabelText("邮箱"), "writer@example.com");
    await user.type(screen.getByLabelText("密码"), "secret123");
    await user.click(screen.getByRole("button", { name: "登录" }));

    expect(await screen.findByText("登录失败，请确认邮箱、密码和账户状态")).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("ChatMentionInput", () => {
  const chapter: ChatReference = { type: "chapter", id: "c1", name: "第一章", summary: "开场" };
  const character: ChatReference = { type: "character", id: "p1", name: "苏白", summary: "线人" };

  it("submits from the send button and exposes imperative text helpers", async () => {
    const user = userEvent.setup();
    const ref = createRef<ChatMentionInputHandle>();
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <div>
        <button onClick={() => ref.current?.setText("帮我扩写")}>写入提示</button>
        <ChatMentionInput
          ref={ref}
          valueText=""
          mentions={[]}
          items={[chapter]}
          recentItems={[]}
          onChange={onChange}
          onSelectReference={vi.fn()}
          onSubmit={onSubmit}
        />
      </div>
    );

    await user.click(screen.getByRole("button", { name: "写入提示" }));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith("帮我扩写", []));
    await user.click(screen.getByRole("button", { name: "发送消息" }));
    expect(onSubmit).toHaveBeenCalled();

    act(() => ref.current?.clear());
    expect(onChange).toHaveBeenLastCalledWith("", []);
  });

  it("selects mention references from the official suggestion list", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSelectReference = vi.fn();
    const { container } = render(
      <ChatMentionInput
        valueText=""
        mentions={[]}
        items={[chapter, character]}
        recentItems={[character]}
        onChange={onChange}
        onSelectReference={onSelectReference}
        onSubmit={vi.fn()}
      />
    );
    const editor = container.querySelector("[contenteditable='true']");
    expect(editor).toBeTruthy();

    await user.type(editor as HTMLElement, "@苏");
    const option = await screen.findByText("苏白");
    await user.click(option.closest("button") as HTMLButtonElement);

    expect(onSelectReference).toHaveBeenCalledWith(character);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.stringContaining("@苏白"), [
        { type: "character", id: "p1", label: "苏白", start: 0, end: 3 }
      ])
    );
  });

  it("keeps duplicate mention occurrences in order", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <ChatMentionInput
        valueText=""
        mentions={[]}
        items={[character]}
        recentItems={[]}
        onChange={onChange}
        onSelectReference={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const editor = container.querySelector("[contenteditable='true']");
    expect(editor).toBeTruthy();

    await user.type(editor as HTMLElement, "@苏");
    await user.click((await screen.findByText("苏白")).closest("button") as HTMLButtonElement);
    await user.type(editor as HTMLElement, "和 @苏");
    await user.click((await screen.findByText("苏白")).closest("button") as HTMLButtonElement);

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("@苏白 和 @苏白 ", [
        { type: "character", id: "p1", label: "苏白", start: 0, end: 3 },
        { type: "character", id: "p1", label: "苏白", start: 6, end: 9 }
      ])
    );
  });

  it("disables sending while streaming", () => {
    render(
      <ChatMentionInput
        valueText="等待"
        mentions={[]}
        items={[]}
        recentItems={[]}
        disabled
        onChange={vi.fn()}
        onSelectReference={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "发送消息" })).toBeDisabled();
  });
});

describe("useIsMobile", () => {
  it("tracks the current viewport width", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });
});
