import { describe, expect, it, vi } from "vitest";
import {
  ApiClient,
  ApiError,
  defaultApiBaseUrl,
  mapChapter,
  mapChatSession,
  mapNamedContent,
  mapWork,
  normalizeBaseUrl
} from "../src/api";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status });
}

function csrfResponse(token = "csrf-token"): Response {
  return jsonResponse({ csrf_token: token });
}

function apiCalls(fetcher: { mock: { calls: Array<Parameters<typeof fetch>> } }) {
  return fetcher.mock.calls.filter((call) => !String(call[0]).endsWith("/csrf"));
}

function queuedFetcher(...responses: Response[]) {
  const queue = [...responses];
  return vi.fn<typeof fetch>(async (input) => {
    if (String(input).endsWith("/csrf")) {
      return csrfResponse();
    }
    const response = queue.shift();
    if (!response) {
      throw new Error(`Unexpected fetch call: ${String(input)}`);
    }
    return response;
  });
}

describe("api client", () => {
  it("normalizes urls and maps api shapes", () => {
    expect(normalizeBaseUrl("http://api///")).toBe("http://api");
    expect(
      mapWork({
        id: "w1",
        title: "作品",
        short_intro: "简介",
        synopsis: "梗概",
        genre_tags: ["奇幻"],
        background_rules: "规则"
      })
    ).toEqual({
      id: "w1",
      title: "作品",
      shortIntro: "简介",
      synopsis: "梗概",
      backgroundRules: "规则",
      focusRequirements: "",
      forbiddenRequirements: "",
      updatedAt: "",
      tags: ["奇幻"]
    });
    expect(mapChapter({ id: "c1", order_index: 1, title: "章", summary: null, content: "正文" })).toEqual({
      id: "c1",
      order: 1,
      title: "章",
      summary: "",
      content: "正文"
    });
    expect(mapChapter({ id: "c2", order_index: 2, title: "章二", summary: "摘要", content: "正文" }).summary).toBe(
      "摘要"
    );
    expect(mapNamedContent({ id: "n1", work_id: "w1", name: "林昼", summary: "摘要", detail: null })).toEqual({
      id: "n1",
      name: "林昼",
      summary: "摘要",
      detail: "",
      type: undefined,
      updatedAt: ""
    });
    expect(
      mapNamedContent({
        id: "n2",
        work_id: "w1",
        name: "有更新时间",
        summary: "摘要",
        detail: "详情",
        updated_at: "2026-04-26T08:00:00Z"
      })
    ).toMatchObject({
      id: "n2",
      updatedAt: "2026-04-26T08:00:00Z"
    });
    expect(
      mapChatSession({
        id: "s1",
        work_id: "w1",
        title: "会话",
        source_type: "manual",
        last_message_preview: null,
        last_active_at: "now"
      })
    ).toEqual({ id: "s1", title: "会话", sourceType: "manual", lastMessagePreview: "", lastActiveAt: "now" });
  });

  it("logs in with cookies and calls user workspace endpoints", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ user: { id: "u1", email: "a@example.com", nickname: "A", role: "user", status: "active" } }))
      .mockResolvedValueOnce(jsonResponse([{ id: "w1", title: "作品", short_intro: "", synopsis: "", genre_tags: [], background_rules: "" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "w2", title: "新作", short_intro: "", synopsis: "", genre_tags: [], background_rules: "" }))
      .mockResolvedValueOnce(jsonResponse({ id: "w3", title: "完整新作", short_intro: "短", synopsis: "梗概", genre_tags: ["悬疑"], background_rules: "规则", focus_requirements: "重点", forbidden_requirements: "禁忌", updated_at: "now" }))
      .mockResolvedValueOnce(jsonResponse({ id: "w4", title: "未命名作品", short_intro: "", synopsis: "", genre_tags: [], background_rules: "", focus_requirements: "", forbidden_requirements: "" }))
      .mockResolvedValueOnce(jsonResponse({ id: "w1", title: "作品", short_intro: "", synopsis: "", genre_tags: [], background_rules: "" }))
      .mockResolvedValueOnce(jsonResponse({ id: "w1", title: "作品改", short_intro: "短", synopsis: "梗概", genre_tags: ["奇幻"], background_rules: "规则" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse([{ id: "c1", order_index: 1, title: "章", summary: "摘要", content: "正文" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "c2", order_index: 2, title: "新章", summary: "提要", content: "" }))
      .mockResolvedValueOnce(jsonResponse({ id: "c3", order_index: 3, title: "只给标题", summary: "", content: "正文" }))
      .mockResolvedValueOnce(jsonResponse({ id: "c1", order_index: 1, title: "章改", summary: "摘要", content: "正文" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ suggestions: [{ quote: "正文", issue: "问题", options: ["改文"] }] }))
      .mockResolvedValueOnce(jsonResponse([{ id: "char-1", work_id: "w1", name: "角色", summary: "摘要", detail: "详情" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "char-2", work_id: "w1", name: "新角色", summary: "摘要", detail: "" }))
      .mockResolvedValueOnce(jsonResponse({ id: "char-2", work_id: "w1", name: "新角色改", summary: "新摘要", detail: "新详情" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse([{ id: "set-1", work_id: "w1", name: "设定", summary: "摘要", detail: "详情", type: "world" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "set-2", work_id: "w1", name: "新设定", summary: "摘要", detail: "", type: "other" }))
      .mockResolvedValueOnce(jsonResponse([{ id: "set-3", work_id: "w1", name: "筛选设定", summary: "摘要", detail: null, type: "other" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "set-4", work_id: "w1", name: "规则设定", summary: "摘要", detail: null, type: "rule" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "set-2", work_id: "w1", name: "设定改", summary: "新摘要", detail: "详情", type: "rule" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          user: { id: "u1", email: "a@example.com", nickname: "A", role: "user", status: "active" },
          points: { monthlyPoints: 10, topupPoints: 5 }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          user: { id: "u1", email: "a@example.com", nickname: "A", role: "user", status: "active" },
          points: { monthly_points_balance: 0, topup_points_balance: 0 },
          subscription: { id: "sub-1", plan_id: "plan-1", start_at: "1", end_at: "2", next_renew_at: "3" }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          user: { id: "u1", email: "a@example.com", nickname: "A", role: "user", status: "active" },
          points: {}
        })
      )
      .mockResolvedValueOnce(jsonResponse({ id: "u1", email: "a@example.com", nickname: "B", role: "user", status: "active" }))
      .mockResolvedValueOnce(
        jsonResponse({
          plans: [{ id: "plan-1", name: "专业版", price_amount: "29.00", monthly_points: 100, bundled_topup_points: 20 }],
          topup_packs: [{ id: "pack-1", name: "加油包", price_amount: "9.00", points: 50 }]
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "order-1",
          order_no: "NO1",
          product_type: "plan",
          product_name_snapshot: "专业版",
          amount: "29.00",
          status: "pending",
          qr_code: "qr"
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "order-1",
          order_no: "NO1",
          product_type: "plan",
          product_name_snapshot: "专业版",
          amount: "29.00",
          status: "paid",
          qr_code: null
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "order-1",
          order_no: "NO1",
          product_type: "plan",
          product_name_snapshot: "专业版",
          amount: "29.00",
          status: "paid",
          qr_code: null
        })
      )
      .mockResolvedValueOnce(jsonResponse([{ id: "s1", work_id: "w1", title: "会话", source_type: "manual", last_message_preview: "预览", last_active_at: "now" }]))
      .mockResolvedValueOnce(jsonResponse({ id: "s2", work_id: "w1", title: "新的对话", source_type: "manual", last_message_preview: null, last_active_at: "now" }))
      .mockResolvedValueOnce(
        jsonResponse({
          messages: [
            { id: "m1", role: "user", content: "@章 hi", references: [], actions: [], created_at: "1" }
          ],
          has_more: false,
          next_before: null
        })
      );
    const client = new ApiClient("http://api/", fetcher);

    await expect(client.loginWithEmail("a@example.com", "secret123")).resolves.toMatchObject({ id: "u1" });
    await expect(client.listWorks()).resolves.toHaveLength(1);
    await expect(client.createWork("新作")).resolves.toMatchObject({ title: "新作" });
    await expect(
      client.createWork({
        title: "完整新作",
        shortIntro: "短",
        synopsis: "梗概",
        tags: ["悬疑"],
        backgroundRules: "规则",
        focusRequirements: "重点",
        forbiddenRequirements: "禁忌"
      })
    ).resolves.toMatchObject({ title: "完整新作", focusRequirements: "重点", forbiddenRequirements: "禁忌" });
    await expect(client.createWork({})).resolves.toMatchObject({ title: "未命名作品" });
    expect(JSON.parse(fetcher.mock.calls[4][1]?.body as string).title).toBe("");
    await expect(client.getWork("w1")).resolves.toMatchObject({ id: "w1" });
    await expect(
      client.updateWork({
        id: "w1",
        title: "作品改",
        shortIntro: "短",
        synopsis: "梗概",
        tags: ["奇幻"],
        backgroundRules: "规则",
        focusRequirements: "",
        forbiddenRequirements: "",
        updatedAt: ""
      })
    ).resolves.toMatchObject({ title: "作品改", backgroundRules: "规则" });
    await expect(client.deleteWork("w1")).resolves.toBeUndefined();
    await expect(client.listChapters("w1")).resolves.toMatchObject([{ id: "c1" }]);
    await expect(client.createChapter("w1", { title: "新章", summary: "提要", order: 2 })).resolves.toMatchObject({
      id: "c2",
      title: "新章"
    });
    await expect(client.createChapter("w1", { title: "只给标题", content: "正文" })).resolves.toMatchObject({
      id: "c3",
      summary: ""
    });
    await expect(
      client.updateChapter("w1", { id: "c1", order: 1, title: "章改", summary: "摘要", content: "正文" })
    ).resolves.toMatchObject({ title: "章改" });
    await expect(client.deleteChapter("w1", "c1")).resolves.toBeUndefined();
    await expect(client.analyzeChapter("w1", "正文")).resolves.toMatchObject([{ quote: "正文" }]);
    await expect(client.listCharacters("w1", "角")).resolves.toMatchObject([{ id: "char-1" }]);
    await expect(client.createCharacter("w1", { name: "新角色", summary: "摘要" })).resolves.toMatchObject({
      id: "char-2"
    });
    await expect(
      client.updateCharacter("w1", { id: "char-2", name: "新角色改", summary: "新摘要", detail: "新详情" })
    ).resolves.toMatchObject({
      name: "新角色改"
    });
    await expect(client.deleteCharacter("w1", "char-2")).resolves.toBeUndefined();
    await expect(client.listSettings("w1")).resolves.toMatchObject([{ id: "set-1", type: "world" }]);
    await expect(client.createSetting("w1", { name: "新设定", summary: "摘要" })).resolves.toMatchObject({
      id: "set-2"
    });
    await expect(client.listSettings("w1", "设")).resolves.toMatchObject([{ id: "set-3" }]);
    await expect(client.listSettings("w1", "设", "rule")).resolves.toMatchObject([{ id: "set-4", type: "rule" }]);
    await expect(
      client.updateSetting("w1", { id: "set-2", name: "设定改", summary: "新摘要", detail: "详情" })
    ).resolves.toMatchObject({ name: "设定改", type: "rule" });
    await expect(client.deleteSetting("w1", "set-2")).resolves.toBeUndefined();
    await expect(client.getMe()).resolves.toMatchObject({ points: { totalPoints: 15 }, subscription: null });
    await expect(client.getMe()).resolves.toMatchObject({ points: { totalPoints: 0 }, subscription: { id: "sub-1" } });
    await expect(client.getMe()).resolves.toMatchObject({ points: { totalPoints: 0 }, subscription: null });
    await expect(client.updateMe("B")).resolves.toMatchObject({ nickname: "B" });
    await expect(client.listBillingProducts()).resolves.toMatchObject({
      plans: [{ id: "plan-1", monthlyPoints: 100, bundledTopupPoints: 20 }],
      topupPacks: [{ id: "pack-1", points: 50, expireDays: 30 }]
    });
    await expect(client.createBillingOrder("plan", "plan-1")).resolves.toMatchObject({ id: "order-1", qrCode: "qr" });
    await expect(client.getBillingOrder("order-1")).resolves.toMatchObject({ id: "order-1", qrCode: "" });
    await expect(client.simulatePaid("order-1")).resolves.toMatchObject({ id: "order-1", status: "paid" });
    await expect(client.listChatSessions("w1")).resolves.toMatchObject([{ id: "s1" }]);
    await expect(client.createChatSession("w1")).resolves.toMatchObject({ id: "s2", lastMessagePreview: "" });
    await expect(client.listChatMessages("s1")).resolves.toMatchObject({ messages: [{ id: "m1" }] });

    expect(fetcher.mock.calls[1][1]?.headers).toBeInstanceOf(Headers);
    expect((fetcher.mock.calls[1][1]?.headers as Headers).get("Authorization")).toBeNull();
    expect(fetcher.mock.calls[1][1]?.credentials).toBe("include");
    expect(fetcher.mock.calls.map((call) => call[0])).toContain("http://api/works/w1/chapters");
    expect(fetcher.mock.calls.map((call) => call[0])).toContain("http://api/works/w1/chat-sessions?limit=20");
    expect(fetcher.mock.calls.map((call) => call[0])).toContain("http://api/chat-sessions/s1/messages?limit=30");
  });

  it("loads the workspace bootstrap bundle in one request", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({
        work: { id: "w1", title: "作品", short_intro: "短", synopsis: "梗概", genre_tags: ["奇幻"], background_rules: "规则" },
        chapters: [{ id: "c1", order_index: 1, title: "第一章", summary: null, content: "正文" }],
        characters: [{ id: "char-1", work_id: "w1", name: "角色", summary: "摘要", detail: null }],
        settings: [{ id: "set-1", work_id: "w1", name: "设定", summary: "摘要", detail: "详情", type: "rule" }],
        sessions: [
          {
            id: "s1",
            work_id: "w1",
            title: "新的对话",
            source_type: "manual",
            last_message_preview: null,
            last_active_at: "now"
          }
        ],
        active_session: {
          id: "s1",
          work_id: "w1",
          title: "新的对话",
          source_type: "manual",
          last_message_preview: null,
          last_active_at: "now"
        },
        messages: {
          messages: [{ id: "m1", role: "assistant", content: "欢迎", references: [], actions: [], created_at: "1" }],
          has_more: false,
          next_before: null
        },
        profile: {
          user: { id: "u1", email: "a@example.com", nickname: "A", role: "user", status: "active" },
          points: { monthly_points_balance: 1, topup_points_balance: 2 },
          subscription: null
        }
      })
    );
    const client = new ApiClient("http://api/", fetcher);

    await expect(client.getWorkspaceBootstrap("w1")).resolves.toMatchObject({
      work: { id: "w1" },
      chapters: [{ id: "c1", summary: "" }],
      characters: [{ id: "char-1", detail: "" }],
      settings: [{ id: "set-1", type: "rule" }],
      activeSession: { id: "s1", lastMessagePreview: "" },
      messages: { messages: [{ id: "m1" }], hasMore: false },
      profile: { points: { totalPoints: 3 } }
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("http://api/works/w1/workspace-bootstrap?session_limit=20&message_limit=30");
    expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
  });

  it("calls cookie-based register, admin login, and logout endpoints", async () => {
    const user = { id: "u1", email: "a@example.com", nickname: "A", role: "user", status: "active" };
    const admin = { id: "admin", email: "admin@example.com", nickname: "Admin", role: "admin", status: "active" };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ user }))
      .mockResolvedValueOnce(jsonResponse({ user: admin }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const client = new ApiClient("http://api/", fetcher);

    await expect(client.registerWithEmail("a@example.com", "A", "secret123")).resolves.toMatchObject({ id: "u1" });
    await expect(client.loginAdmin("admin@example.com", "admin-secret")).resolves.toMatchObject({ role: "admin" });
    await expect(client.logout()).resolves.toBeUndefined();

    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "http://api/auth/register",
      "http://api/admin/login",
      "http://api/auth/logout"
    ]);
    expect(fetcher.mock.calls.every((call) => call[1]?.credentials === "include")).toBe(true);
  });

  it("streams chat messages and parses final assistant message", async () => {
    const final = {
      id: "a1",
      role: "assistant",
      content: "你好",
      references: [],
      actions: [{ type: "update_chapter_summary", label: "更新章节提要" }],
      created_at: "now"
    };
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode("data: 你\n\n"));
        controller.enqueue(encoder.encode(`data: 好\n\nevent: done\ndata: ${JSON.stringify(final)}`));
        controller.close();
      }
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, { status: 200 }));
    const client = new ApiClient("http://api", fetcher);
    const chunks: string[] = [];

    await expect(client.streamChatMessage("s1", "hi", [], [], (chunk) => chunks.push(chunk), "model-1")).resolves.toMatchObject({
      id: "a1",
      content: "你好"
    });
    expect(chunks).toEqual(["你", "好"]);
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toEqual({
      message: "hi",
      references: [],
      mentions: [],
      model_id: "model-1"
    });
  });

  it("handles chat pagination, empty sse events, and missing stream bodies", async () => {
    const final = {
      id: "a2",
      role: "assistant",
      content: "完成",
      created_at: "now"
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ id: "char-1", work_id: "w1", name: "角色", summary: "摘要", detail: null }]))
      .mockResolvedValueOnce(
        jsonResponse({
          messages: [],
          has_more: true,
          next_before: "older"
        })
      )
      .mockResolvedValueOnce(
        new Response(
          new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(encoder.encode(`data: 片段\n\n\n\nevent: done\ndata: ${JSON.stringify(final)}\n\n`));
              controller.close();
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const client = new ApiClient("http://api", fetcher);
    const chunks: string[] = [];

    await expect(client.listCharacters("w1")).resolves.toMatchObject([{ id: "char-1" }]);
    await expect(client.listChatMessages("s1", 20, "m1")).resolves.toMatchObject({
      hasMore: true,
      nextBefore: "older"
    });
    await expect(client.streamChatMessage("s1", "hi", [], [], (chunk) => chunks.push(chunk))).resolves.toMatchObject({
      id: "a2"
    });
    expect(chunks).toEqual(["片段"]);
    await expect(client.streamChatMessage("s1", "hi", [], [], vi.fn())).rejects.toMatchObject(
      new ApiError("stream body unavailable", 200)
    );
  });

  it("rejects malformed chat streams", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: only chunk\n\n"));
        controller.close();
      }
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream, { status: 200 }));
    await expect(new ApiClient("http://api", fetcher).streamChatMessage("s1", "hi", [], [], vi.fn())).rejects.toMatchObject(
      new ApiError("missing final assistant message", 200)
    );
  });

  it("uses cookie credentials and raises typed errors", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("nope", { status: 403 }));
    const client = new ApiClient("http://api", fetcher);
    await expect(client.listWorks()).rejects.toMatchObject(new ApiError("nope", 403));
    expect((fetcher.mock.calls[0][1]?.headers as Headers).get("Authorization")).toBeNull();
    expect(fetcher.mock.calls[0][1]?.credentials).toBe("include");
  });

  it("sends csrf tokens for writes but not reads", async () => {
    const fetcher = queuedFetcher(
      jsonResponse([]),
      jsonResponse({ id: "w1", title: "新作", short_intro: "", synopsis: "", genre_tags: [], background_rules: "" })
    );
    const client = new ApiClient("http://api", fetcher);

    await expect(client.listWorks()).resolves.toEqual([]);
    await expect(client.createWork("新作")).resolves.toMatchObject({ id: "w1" });

    const calls = apiCalls(fetcher);
    expect((calls[0][1]?.headers as Headers).get("X-CSRF-Token")).toBeNull();
    expect((calls[1][1]?.headers as Headers).get("X-CSRF-Token")).toBe("csrf-token");
  });

  it("fetches and refreshes csrf tokens when needed", async () => {
    document.cookie = "jfxz_csrf=; Max-Age=0; path=/";
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/csrf") && fetcher.mock.calls.filter((call) => String(call[0]).endsWith("/csrf")).length === 1) {
        return csrfResponse("stale-token");
      }
      if (url.endsWith("/csrf")) {
        return csrfResponse("fresh-token");
      }
      if (url.endsWith("/works") && fetcher.mock.calls.filter((call) => String(call[0]).endsWith("/works")).length === 1) {
        return new Response("invalid csrf token", { status: 403 });
      }
      return jsonResponse({ id: "w1", title: "新作", short_intro: "", synopsis: "", genre_tags: [], background_rules: "" });
    });
    const client = new ApiClient("http://api", fetcher);

    await expect(client.createWork("新作")).resolves.toMatchObject({ id: "w1" });

    const writeCalls = fetcher.mock.calls.filter((call) => String(call[0]).endsWith("/works"));
    expect((writeCalls[0][1]?.headers as Headers).get("X-CSRF-Token")).toBe("stale-token");
    expect((writeCalls[1][1]?.headers as Headers).get("X-CSRF-Token")).toBe("fresh-token");
  });

  it("calls auth and admin endpoints with cookie credentials", async () => {
    const user = { id: "u1", email: "a@example.com", nickname: "A", role: "user", status: "active" };
    const admin = { id: "admin-1", email: "admin@example.com", nickname: "Admin", role: "admin", status: "active" };
    const productInput = {
      name: "专业版",
      priceAmount: "29.00",
      monthlyPoints: 100,
      bundledTopupPoints: 20,
      points: 50,
      expireDays: 30,
      status: "active",
      sortOrder: 1
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ user }))
      .mockResolvedValueOnce(jsonResponse({ user: admin }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ items: [user], total: 1, page: 1, page_size: 20 }))
      .mockResolvedValueOnce(jsonResponse({ user, points: { monthly_points_balance: 2, topup_points_balance: 3 } }))
      .mockResolvedValueOnce(jsonResponse({ ...user, nickname: "B" }))
      .mockResolvedValueOnce(jsonResponse({ plans: [], topup_packs: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: "plan-1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "plan-1", name: "专业版改" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "order-1",
              order_no: "NO1",
              user_id: "u1",
              user_email: "a@example.com",
              product_type: "plan",
              product_name_snapshot: "专业版",
              amount: "29.00",
              currency: "CNY",
              status: "paid",
              created_at: "now",
              paid_at: "now"
            }
          ],
          total: 1,
          page: 1,
          page_size: 20
        })
      )
      .mockResolvedValueOnce(jsonResponse({ order: { id: "order-1" }, payments: [], grants: [] }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "sub-1",
              user_id: "u1",
              user_email: "a@example.com",
              plan_id: "plan-1",
              plan_name: "专业版",
              order_id: "order-1",
              order_no: "NO1",
              status: "active",
              start_at: "1",
              end_at: "2",
              next_renew_at: null
            }
          ],
          total: 1,
          page: 1,
          page_size: 20
        })
      )
      .mockResolvedValueOnce(jsonResponse({ subscription: { id: "sub-1" }, user, plan: {}, order: null }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "s1",
              work_id: "w1",
              work_title: "作品",
              user_id: "u1",
              user_email: "a@example.com",
              agno_session_id: "agno-1",
              title: "会话",
              source_type: "manual",
              last_message_preview: null,
              last_active_at: "now"
            }
          ],
          total: 1,
          page: 1,
          page_size: 20
        })
      )
      .mockResolvedValueOnce(jsonResponse({ session: { id: "s1" }, agent: { runs: [] } }))
      .mockResolvedValueOnce(
        jsonResponse({
          items: [
            {
              id: "cfg-1",
              config_group: "payment",
              config_key: "app_private_key",
              value_type: "string",
              string_value: "******",
              integer_value: null,
              decimal_value: null,
              boolean_value: null,
              json_value: null,
              description: null,
              is_required: true
            }
          ],
          total: 1,
          page: 1,
          page_size: 20
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "cfg-1",
          config_group: "payment",
          config_key: "app_private_key",
          value_type: "string",
          string_value: "******",
          integer_value: null,
          decimal_value: null,
          boolean_value: null,
          json_value: null,
          description: null,
          is_required: true
        })
      );
    const client = new ApiClient("http://api/", fetcher);

    await expect(client.registerWithEmail("a@example.com", "A", "secret123")).resolves.toMatchObject({ id: "u1" });
    await expect(client.loginAdmin("admin@example.com", "admin123")).resolves.toMatchObject({ role: "admin" });
    await expect(client.logout()).resolves.toBeUndefined();
    await expect(client.listAdminUsers("a@")).resolves.toMatchObject({ total: 1, items: [user] });
    await expect(client.getAdminUser("u1")).resolves.toMatchObject({ points: { totalPoints: 5 } });
    await expect(client.updateAdminUser("u1", { nickname: "B", status: "active" })).resolves.toMatchObject({ nickname: "B" });
    await expect(client.listAdminProducts()).resolves.toEqual({ plans: [], topup_packs: [] });
    await expect(client.createAdminProduct("plans", productInput)).resolves.toMatchObject({ id: "plan-1" });
    await expect(client.updateAdminProduct("plans", "plan-1", productInput)).resolves.toMatchObject({ name: "专业版改" });
    await expect(client.deleteAdminProduct("plans", "plan-1")).resolves.toBeUndefined();
    await expect(client.listAdminOrders({ q: "a@", status: "paid", productType: "plan" })).resolves.toMatchObject({ total: 1 });
    await expect(client.getAdminOrder("order-1")).resolves.toMatchObject({ order: { id: "order-1" } });
    await expect(client.listAdminSubscriptions({ q: "a@", status: "active" })).resolves.toMatchObject({ total: 1 });
    await expect(client.getAdminSubscription("sub-1")).resolves.toMatchObject({ subscription: { id: "sub-1" } });
    await expect(client.listAdminSessions("作品")).resolves.toMatchObject({ total: 1 });
    await expect(client.getAdminSession("s1")).resolves.toMatchObject({ session: { id: "s1" } });
    await expect(client.listAdminConfigs("payment")).resolves.toMatchObject({ total: 1 });
    await expect(client.updateAdminConfig("cfg-1", { string_value: "******" })).resolves.toMatchObject({
      config_key: "app_private_key",
      string_value: "******"
    });

    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      "http://api/auth/register",
      "http://api/admin/login",
      "http://api/auth/logout",
      "http://api/admin/users?q=a%40",
      "http://api/admin/users/u1",
      "http://api/admin/users/u1",
      "http://api/admin/products",
      "http://api/admin/products/plans",
      "http://api/admin/products/plans/plan-1",
      "http://api/admin/products/plans/plan-1",
      "http://api/admin/orders?q=a%40&status=paid&product_type=plan",
      "http://api/admin/orders/order-1",
      "http://api/admin/subscriptions?q=a%40&status=active",
      "http://api/admin/subscriptions/sub-1",
      "http://api/admin/sessions?q=%E4%BD%9C%E5%93%81",
      "http://api/admin/sessions/s1",
      "http://api/admin/configs?group=payment",
      "http://api/admin/configs/cfg-1"
    ]);
    for (const call of fetcher.mock.calls) {
      expect(call[1]?.credentials).toBe("include");
      expect((call[1]?.headers as Headers).get("Authorization")).toBeNull();
    }
  });

  it("calls ai model endpoints with filters and payload mapping", async () => {
    const model = {
      id: "model-1",
      display_name: "DeepSeek-v4-flash",
      provider_model_id: "deepseek-v4-flash",
      description: "快速",
      logic_score: 3,
      prose_score: 3,
      knowledge_score: 3,
      max_context_tokens: 64000,
      max_output_tokens: 4096,
      temperature: "0.70",
      cache_hit_input_multiplier: "0.11",
      cache_miss_input_multiplier: "0.11",
      output_multiplier: "0.22",
      status: "active",
      sort_order: 1,
      created_at: "now",
      updated_at: "now"
    };
    const publicModel = {
      id: model.id,
      display_name: model.display_name,
      description: model.description,
      logic_score: model.logic_score,
      prose_score: model.prose_score,
      knowledge_score: model.knowledge_score,
      max_context_tokens: model.max_context_tokens,
      max_output_tokens: model.max_output_tokens,
      temperature: model.temperature,
      status: model.status,
      sort_order: model.sort_order
    };
    const input = {
      displayName: "测试模型",
      providerModelId: "test-model",
      description: "描述",
      logicScore: 4,
      proseScore: 3,
      knowledgeScore: 5,
      maxContextTokens: 32000,
      maxOutputTokens: 2048,
      temperature: "0.80",
      cacheHitInputMultiplier: "0.10",
      cacheMissInputMultiplier: "0.20",
      outputMultiplier: "0.30",
      status: "active" as const,
      sortOrder: 9
    };
    const fetcher = queuedFetcher(
      jsonResponse([publicModel]),
      jsonResponse({ items: [model], total: 1, page: 1, page_size: 10 }),
      jsonResponse({ ...model, id: "model-2", display_name: "测试模型" }),
      jsonResponse({ ...model, display_name: "测试模型改" })
    );
    const client = new ApiClient("http://api", fetcher);

    await expect(client.listAiModels()).resolves.toMatchObject([{ id: "model-1", display_name: "DeepSeek-v4-flash" }]);
    await expect(
      client.listAdminModels({
        q: "DeepSeek",
        status: "active",
        logicMin: 3,
        logicMax: 5,
        contextMin: 1000,
        contextMax: 100000,
        outputMin: 100,
        outputMax: 9000,
        page: 1,
        pageSize: 10
      })
    ).resolves.toMatchObject({ total: 1 });
    await expect(client.createAdminModel(input)).resolves.toMatchObject({ id: "model-2" });
    await expect(client.updateAdminModel("model-2", { ...input, displayName: "测试模型改" })).resolves.toMatchObject({
      display_name: "测试模型改"
    });

    const calls = apiCalls(fetcher);
    expect(calls.map((call) => call[0])).toEqual([
      "http://api/ai/models",
      "http://api/admin/models?q=DeepSeek&status=active&page=1&page_size=10&logic_min=3&logic_max=5&context_min=1000&context_max=100000&output_min=100&output_max=9000",
      "http://api/admin/models",
      "http://api/admin/models/model-2"
    ]);
    expect(JSON.parse(calls[2][1]?.body as string)).toMatchObject({
      display_name: "测试模型",
      provider_model_id: "test-model",
      cache_hit_input_multiplier: "0.10"
    });
  });

  it("uses environment and browser-host default base urls", async () => {
    const original = process.env.NEXT_PUBLIC_API_BASE_URL;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));

    process.env.NEXT_PUBLIC_API_BASE_URL = "http://env-api/";
    await new ApiClient(undefined, fetcher).listWorks();
    expect(fetcher.mock.calls[0][0]).toBe("http://env-api/works");

    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    await new ApiClient(undefined, fetcher).listWorks();
    expect(fetcher.mock.calls[1][0]).toBe(`${window.location.protocol}//${window.location.hostname}:8000/works`);
    expect(defaultApiBaseUrl()).toBe(`${window.location.protocol}//${window.location.hostname}:8000`);

    process.env.NEXT_PUBLIC_API_BASE_URL = original;
  });

  it("uses the global fetch wrapper by default", async () => {
    const originalFetch = globalThis.fetch;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    globalThis.fetch = fetcher;
    await expect(new ApiClient("http://global-api").listWorks()).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledWith(
      "http://global-api/works",
      expect.objectContaining({ cache: "no-store" })
    );
    globalThis.fetch = originalFetch;
  });
});
