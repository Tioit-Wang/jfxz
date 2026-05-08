import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiModelOption, ApiClient, ChatReference } from "../src/api";
import { AuthModal } from "../src/components/AuthModal";
import { ChatMentionInput, type ChatMentionInputHandle } from "../src/components/ChatMentionInput";
import { ModelPicker } from "../src/components/ModelPicker";
import { BillingDialog } from "../src/components/billing/BillingDialog";
import { PaymentDialog } from "../src/components/billing/PaymentDialog";
import { useIsMobile } from "../src/hooks/use-mobile";
import { formatToken } from "../src/lib/format";
import { parseWorkspaceMentionDragPayload, serializeWorkspaceMentionDragPayload } from "../app/books/[bookId]/workspace/dnd";

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
    expect(window.localStorage.getItem("goodgua-user-token")).toBeNull();
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
  const setting: ChatReference = { type: "setting", id: "s1", name: "刘家祖训", summary: "设定条目" };

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

  it("appends an imperative mention at the input end", async () => {
    const ref = createRef<ChatMentionInputHandle>();
    const onChange = vi.fn();
    render(
      <ChatMentionInput
        ref={ref}
        valueText=""
        mentions={[]}
        items={[chapter, character]}
        recentItems={[]}
        onChange={onChange}
        onSelectReference={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    act(() =>
      ref.current?.insertMention({
        type: "character",
        id: "p1",
        name: "苏白",
        summary: "线人"
      })
    );

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith("@苏白 ", [
        { type: "character", id: "p1", label: "苏白", start: 0, end: 3 }
      ])
    );
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

  it("filters mentions by chapter and character names only", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ChatMentionInput
        valueText=""
        mentions={[]}
        items={[chapter, character, setting]}
        recentItems={[setting]}
        onChange={vi.fn()}
        onSelectReference={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    const editor = container.querySelector("[contenteditable='true']");
    expect(editor).toBeTruthy();

    await user.type(editor as HTMLElement, "@刘");

    expect(screen.queryByText("刘家祖训")).not.toBeInTheDocument();
    expect(await screen.findByText("没有匹配的章节或角色")).toBeVisible();
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

describe("billing dialogs", () => {
  const products = {
    plans: [
      {
        id: "plan-1",
        name: "专业版",
        priceAmount: 29,
        vipDailyPoints: 1000,
        bundledCreditPackPoints: 200,
        points: 0
      },
      {
        id: "plan-2",
        name: "基础版",
        priceAmount: 9,
        vipDailyPoints: 200,
        bundledCreditPackPoints: 0,
        points: 0
      }
    ],
    creditPacks: [
      {
        id: "pack-1",
        name: "灵感加油包",
        priceAmount: 19,
        vipDailyPoints: 0,
        bundledCreditPackPoints: 0,
        points: 500
      }
    ]
  };

  it("renders billing states and submits purchases", async () => {
    const user = userEvent.setup();
    const onPurchase = vi.fn();
    const { rerender } = render(
      <BillingDialog
        open
        onOpenChange={vi.fn()}
        products={{ plans: [], creditPacks: [] }}
        loading
        error={false}
        purchasing={false}
        onPurchase={onPurchase}
      />
    );

    expect(screen.getByText("正在加载商品信息...")).toBeVisible();

    rerender(
      <BillingDialog
        open
        onOpenChange={vi.fn()}
        products={{ plans: [], creditPacks: [] }}
        loading={false}
        error
        purchasing={false}
        onPurchase={onPurchase}
      />
    );
    expect(screen.getByText("商品信息加载失败，请关闭后重试。")).toBeVisible();

    rerender(
      <BillingDialog
        open
        onOpenChange={vi.fn()}
        products={products}
        loading={false}
        error={false}
        purchasing={false}
        onPurchase={onPurchase}
      />
    );

    await user.click(screen.getAllByRole("button", { name: "升级会员" })[0]);
    await user.click(screen.getByRole("button", { name: /充值/ }));

    expect(onPurchase).toHaveBeenNthCalledWith(1, "plan", "plan-1");
    expect(onPurchase).toHaveBeenNthCalledWith(2, "credit_pack", "pack-1");
  });

  it("renders payment states and actions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSimulatePaid = vi.fn();
    const pendingOrder = {
      id: "order-1",
      orderNo: "NO1",
      productType: "plan" as const,
      productName: "专业版",
      amount: "29.00",
      status: "pending",
      qrCode: "qr"
    };
    const { rerender } = render(
      <PaymentDialog open onOpenChange={onOpenChange} order={null} creating onSimulatePaid={onSimulatePaid} />
    );

    expect(screen.getByText("正在创建支付订单...")).toBeVisible();

    rerender(
      <PaymentDialog
        open
        onOpenChange={onOpenChange}
        order={pendingOrder}
        creating={false}
        onSimulatePaid={onSimulatePaid}
        testEnabled
      />
    );
    expect(screen.getByText("等待扫码")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "模拟支付成功" }));
    await user.click(screen.getByRole("button", { name: "关闭" }));
    expect(onSimulatePaid).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <PaymentDialog
        open
        onOpenChange={onOpenChange}
        order={{ ...pendingOrder, status: "paid", qrCode: "" }}
        creating={false}
        onSimulatePaid={onSimulatePaid}
        testEnabled
      />
    );
    expect(screen.getAllByText("支付成功")[0]).toBeVisible();

    rerender(
      <PaymentDialog
        open
        onOpenChange={onOpenChange}
        order={{ ...pendingOrder, qrCode: "" }}
        creating={false}
      />
    );
    expect(screen.getByText("获取二维码失败")).toBeVisible();
  });
});

describe("ModelPicker", () => {
  const models: AiModelOption[] = [
    {
      id: "m1",
      display_name: "长篇推理",
      description: "结构强",
      logic_score: 9,
      prose_score: 7,
      knowledge_score: 4,
      max_context_tokens: 1000000,
      max_output_tokens: 1536
    },
    {
      id: "m2",
      display_name: "轻量续写",
      logic_score: 6,
      prose_score: 8,
      knowledge_score: 5,
      max_context_tokens: 32000,
      max_output_tokens: 4000
    }
  ];

  it("opens, selects a model, and closes on outside click", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ModelPicker models={models} selectedId="m2" onSelect={onSelect} />);

    await user.click(screen.getByRole("combobox", { name: "选择对话模型" }));
    expect(screen.getByRole("listbox", { name: "模型列表" })).toBeVisible();
    expect(screen.getByText("1M→1,536")).toBeVisible();
    expect(screen.getByText("32K→4K")).toBeVisible();

    await user.click(screen.getByRole("option", { name: /长篇推理/ }));
    expect(onSelect).toHaveBeenCalledWith("m1");
    expect(screen.queryByRole("listbox", { name: "模型列表" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "选择对话模型" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox", { name: "模型列表" })).not.toBeInTheDocument();
  });

  it("formats token counts", () => {
    expect(formatToken(1000000)).toBe("1M");
    expect(formatToken(32000)).toBe("32K");
    expect(formatToken(1536)).toBe("1,536");
  });
});

describe("workspace mention drag payload", () => {
  it("round-trips a sidebar mention reference", () => {
    const payload = serializeWorkspaceMentionDragPayload({
      type: "chapter",
      id: "c1",
      name: "第一章",
      summary: "开场"
    });

    expect(parseWorkspaceMentionDragPayload(payload)).toEqual({
      type: "chapter",
      id: "c1",
      name: "第一章",
      summary: "开场"
    });
  });

  it("rejects unsupported drag payloads", () => {
    expect(
      parseWorkspaceMentionDragPayload(
        JSON.stringify({
          source: "workspace-sidebar",
          reference: { type: "setting", id: "s1", name: "祖训" }
        })
      )
    ).toBeNull();
  });
});

describe("useIsMobile", () => {
  it("tracks the current viewport width", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 500 });
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });
});
