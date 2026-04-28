import type { Chapter, Work } from "./domain";

export type Fetcher = typeof fetch;

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type ApiWork = {
  id: string;
  title: string;
  short_intro: string;
  synopsis: string;
  genre_tags: string[];
  background_rules: string;
  focus_requirements?: string | null;
  forbidden_requirements?: string | null;
  updated_at?: string | null;
};

export type ApiChapter = {
  id: string;
  order_index: number;
  title: string;
  summary: string | null;
  content: string;
};

export type ApiSuggestion = {
  quote: string;
  issue: string;
  options: string[];
};

export type ApiNamedContent = {
  id: string;
  work_id: string;
  name: string;
  summary: string;
  detail: string | null;
  type?: string | null;
  updated_at?: string | null;
};

export type NamedContent = {
  id: string;
  name: string;
  summary: string;
  detail: string;
  type?: string;
  updatedAt: string;
};

export type ApiChatSession = {
  id: string;
  work_id: string;
  title: string;
  source_type: string;
  last_message_preview: string | null;
  last_active_at: string;
};

export type ChatSession = {
  id: string;
  title: string;
  sourceType: string;
  lastMessagePreview: string;
  lastActiveAt: string;
};

export type ChatReference = {
  type: "chapter" | "character" | "setting" | "suggestion";
  id: string;
  name: string;
  summary?: string;
  quote?: string;
  issue?: string;
  replacement?: string;
};

export type ChatMention = {
  type: "chapter" | "character" | "setting";
  id: string;
  label: string;
  start: number;
  end: number;
};

export type ChatAction = {
  type: "save_character" | "save_setting" | "update_chapter_summary" | "update_work_info";
  label: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  mentions: ChatMention[];
  references: ChatReference[];
  actions: ChatAction[];
  createdAt: string;
  billing_failed?: boolean;
  error?: string | null;
};

export type ChatMessagePage = {
  messages: ChatMessage[];
  hasMore: boolean;
  nextBefore: string | null;
};

export type WorkspaceBootstrap = {
  work: Work;
  chapters: Chapter[];
  characters: NamedContent[];
  settings: NamedContent[];
  sessions: ChatSession[];
  activeSession: ChatSession;
  messages: ChatMessagePage;
  profile: UserProfile;
};

export type ApiUser = {
  id: string;
  email: string;
  nickname: string;
  role: "user" | "admin";
  status: "active" | "disabled";
};

export type PointAccount = {
  vipDailyPoints: number;
  creditPackPoints: number;
  totalPoints: number;
};

export type UserProfile = {
  user: ApiUser;
  points: PointAccount;
  subscription: ApiSubscription | null;
};

export type ApiSubscription = {
  id: string;
  plan_id: string;
  start_at: string;
  end_at: string;
  next_renew_at: string;
};

export type AdminUserListItem = ApiUser & {
  points: { vip_daily_points_balance: number; credit_pack_points_balance: number };
  subscription: ApiSubscription | null;
};

export type AdminBalanceAdjustInput = {
  bucket_type: "vip_daily" | "credit_pack";
  change_type: "grant" | "deduct";
  amount: number;
  reason?: string;
};

export type AdminBalanceAdjustResult = {
  points: { vip_daily_points_balance: number; credit_pack_points_balance: number };
  transaction_id: string;
};

export type BillingProduct = {
  id: string;
  name: string;
  priceAmount: number;
  vipDailyPoints: number;
  bundledCreditPackPoints: number;
  points: number;
};

export type BillingProducts = {
  plans: BillingProduct[];
  creditPacks: BillingProduct[];
};

export type BillingOrder = {
  id: string;
  orderNo: string;
  productType: "plan" | "credit_pack";
  productName: string;
  amount: string;
  status: string;
  qrCode: string;
};

export type AdminProductKind = "plans" | "credit-packs";

export type AdminListParams = {
  q?: string;
  status?: string;
  productType?: string;
  page?: number;
  pageSize?: number;
};

export type AdminProductInput = {
  name: string;
  priceAmount: string;
  vipDailyPoints?: number;
  bundledCreditPackPoints?: number;
  points?: number;
  status: string;
  sortOrder?: number | null;
};

export type AiModelOption = {
  id: string;
  display_name: string;
  description: string | null;
  logic_score: number;
  prose_score: number;
  knowledge_score: number;
  max_context_tokens: number;
  max_output_tokens: number;
  output_multiplier: string;
  temperature: string;
  status: "active" | "inactive";
  sort_order: number | null;
};

export type AdminAiModel = AiModelOption & {
  provider_model_id: string;
  cache_hit_input_multiplier: string;
  cache_miss_input_multiplier: string;
  created_at: string;
  updated_at: string;
};

export type AdminAiModelInput = {
  displayName: string;
  providerModelId: string;
  description?: string | null;
  logicScore: number;
  proseScore: number;
  knowledgeScore: number;
  maxContextTokens: number;
  maxOutputTokens: number;
  temperature: string;
  cacheHitInputMultiplier: string;
  cacheMissInputMultiplier: string;
  outputMultiplier: string;
  status: "active" | "inactive";
  sortOrder?: number | null;
};

export type AdminModelListParams = AdminListParams & {
  logicMin?: number;
  logicMax?: number;
  contextMin?: number;
  contextMax?: number;
  outputMin?: number;
  outputMax?: number;
};

export type AdminConfigValue = {
  string_value?: string | null;
  integer_value?: number | null;
  decimal_value?: string | null;
  boolean_value?: boolean | null;
  json_value?: Record<string, unknown> | null;
};

export type AdminConfig = {
  id: string;
  config_group: string;
  config_key: string;
  value_type: string;
  string_value: string | null;
  integer_value: number | null;
  decimal_value: string | null;
  boolean_value: boolean | null;
  json_value: Record<string, unknown> | null;
  description: string | null;
  is_required: boolean;
};

export type AdminOrder = {
  id: string;
  order_no: string;
  user_id: string;
  user_email?: string;
  product_type: "plan" | "credit_pack";
  product_name_snapshot: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export type AdminCreditTransaction = {
  id: string;
  created_at: string;
  user_id: string;
  user_email?: string;
  balance_type: "vip_daily" | "credit_pack";
  change_type: "grant" | "consume" | "expire" | "refund" | "adjust";
  source_type: string;
  source_id?: string;
  work_id?: string;
  work_title?: string;
  model_id?: string;
  model_name_snapshot?: string;
  cache_hit_input_tokens?: number;
  cache_miss_input_tokens?: number;
  output_tokens?: number;
  cache_hit_input_multiplier_snapshot?: string;
  cache_miss_input_multiplier_snapshot?: string;
  output_multiplier_snapshot?: string;
  platform_call_id?: string;
  points_change: number;
  points_after: number;
  order_id?: string;
  product_name_snapshot?: string;
  product_type?: string;
};

export type CreditTransactionListParams = {
  q?: string;
  balance_type?: string;
  change_type?: string;
  source_type?: string;
  model_id?: string;
  work_id?: string;
  points_min?: number;
  points_max?: number;
  time_from?: string;
  time_to?: string;
  page?: number;
  pageSize?: number;
};

export type AdminSubscription = {
  id: string;
  user_id: string;
  user_email?: string;
  plan_id: string;
  plan_name?: string;
  order_id: string | null;
  order_no?: string | null;
  status: string;
  start_at: string;
  end_at: string;
  next_renew_at: string | null;
};

export type AdminSession = {
  id: string;
  work_id: string;
  work_title?: string;
  user_id: string;
  user_email?: string;
  agno_session_id: string;
  title: string;
  source_type: string;
  last_message_preview: string | null;
  last_active_at: string;
};

export type WorkDraft = {
  title: string;
  shortIntro: string;
  synopsis: string;
  tags: string[];
  backgroundRules: string;
  focusRequirements: string;
  forbiddenRequirements: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function defaultApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
}

function csrfCookieToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("jfxz_csrf="));
  return cookie ? decodeURIComponent(cookie.slice("jfxz_csrf=".length)) : null;
}

export function mapWork(work: ApiWork): Work {
  return {
    id: work.id,
    title: work.title,
    shortIntro: work.short_intro,
    synopsis: work.synopsis,
    backgroundRules: work.background_rules,
    focusRequirements: work.focus_requirements ?? "",
    forbiddenRequirements: work.forbidden_requirements ?? "",
    tags: work.genre_tags,
    updatedAt: work.updated_at ?? ""
  };
}

function workPayload(work: WorkDraft): Record<string, unknown> {
  return {
    title: work.title,
    short_intro: work.shortIntro,
    synopsis: work.synopsis,
    genre_tags: work.tags,
    background_rules: work.backgroundRules,
    focus_requirements: work.focusRequirements,
    forbidden_requirements: work.forbiddenRequirements
  };
}

export function mapChapter(chapter: ApiChapter): Chapter {
  return {
    id: chapter.id,
    order: chapter.order_index,
    title: chapter.title,
    summary: chapter.summary ?? "",
    content: chapter.content
  };
}

export function mapNamedContent(item: ApiNamedContent): NamedContent {
  return {
    id: item.id,
    name: item.name,
    summary: item.summary,
    detail: item.detail ?? "",
    type: item.type ?? undefined,
    updatedAt: item.updated_at ?? ""
  };
}

export function mapChatSession(session: ApiChatSession): ChatSession {
  return {
    id: session.id,
    title: session.title,
    sourceType: session.source_type,
    lastMessagePreview: session.last_message_preview ?? "",
    lastActiveAt: session.last_active_at
  };
}

function mapPoints(item: {
  vip_daily_points_balance?: number;
  credit_pack_points_balance?: number;
  vipDailyPoints?: number;
  creditPackPoints?: number;
}): PointAccount {
  const vipDailyPoints = item.vip_daily_points_balance ?? item.vipDailyPoints ?? 0;
  const creditPackPoints = item.credit_pack_points_balance ?? item.creditPackPoints ?? 0;
  return { vipDailyPoints, creditPackPoints, totalPoints: vipDailyPoints + creditPackPoints };
}

function mapProduct(item: {
  id: string;
  name: string;
  price_amount: string;
  daily_vip_points?: number;
  bundled_credit_pack_points?: number;
  points?: number;
}): BillingProduct {
  return {
    id: item.id,
    name: item.name,
    priceAmount: Number(item.price_amount),
    vipDailyPoints: item.daily_vip_points ?? 0,
    bundledCreditPackPoints: item.bundled_credit_pack_points ?? 0,
    points: item.points ?? 0,
  };
}

function mapOrder(item: {
  id: string;
  order_no: string;
  product_type: "plan" | "credit_pack";
  product_name_snapshot: string;
  amount: string;
  status: string;
  qr_code?: string | null;
}): BillingOrder {
  return {
    id: item.id,
    orderNo: item.order_no,
    productType: item.product_type,
    productName: item.product_name_snapshot,
    amount: item.amount,
    status: item.status,
    qrCode: item.qr_code ?? ""
  };
}

function productPayload(input: AdminProductInput): Record<string, unknown> {
  return {
    name: input.name,
    price_amount: input.priceAmount,
    daily_vip_points: input.vipDailyPoints ?? 0,
    bundled_credit_pack_points: input.bundledCreditPackPoints ?? 0,
    points: input.points ?? 0,
    status: input.status,
    sort_order: input.sortOrder ?? null
  };
}

function aiModelPayload(input: AdminAiModelInput): Record<string, unknown> {
  return {
    display_name: input.displayName,
    provider_model_id: input.providerModelId,
    description: input.description ?? null,
    logic_score: input.logicScore,
    prose_score: input.proseScore,
    knowledge_score: input.knowledgeScore,
    max_context_tokens: input.maxContextTokens,
    max_output_tokens: input.maxOutputTokens,
    temperature: input.temperature,
    cache_hit_input_multiplier: input.cacheHitInputMultiplier,
    cache_miss_input_multiplier: input.cacheMissInputMultiplier,
    output_multiplier: input.outputMultiplier,
    status: input.status,
    sort_order: input.sortOrder ?? null
  };
}

function mapChatMessage(message: {
  id: string;
  role: "user" | "assistant";
  content: string;
  mentions?: ChatMention[];
  references?: ChatReference[];
  actions?: ChatAction[];
  created_at: string;
  billing_failed?: boolean;
  error?: string | null;
}): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    mentions: message.mentions ?? [],
    references: message.references ?? [],
    actions: message.actions ?? [],
    createdAt: message.created_at,
    billing_failed: message.billing_failed,
    error: message.error ?? undefined,
  };
}

export class ApiClient {
  private csrfToken: string | null = null;

  constructor(
    private readonly baseUrl = defaultApiBaseUrl(),
    private readonly fetcher: Fetcher = (...args) => fetch(...args)
  ) {}

  async registerWithEmail(email: string, nickname: string | undefined, password: string): Promise<ApiUser> {
    const data = await this.request<{ user: ApiUser }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, nickname, password })
    });
    return data.user;
  }

  async loginWithEmail(email: string, password: string): Promise<ApiUser> {
    const data = await this.request<{ user: ApiUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    return data.user;
  }

  async loginAdmin(email: string, password: string): Promise<ApiUser> {
    const data = await this.request<{ user: ApiUser }>("/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    return data.user;
  }

  async logout(): Promise<void> {
    await this.request<{ ok: boolean }>("/auth/logout", { method: "POST" });
  }

  async getMe(): Promise<UserProfile> {
    const data = await this.request<{
      user: ApiUser;
      points: { vip_daily_points_balance: number; credit_pack_points_balance: number };
      subscription?: ApiSubscription | null;
    }>("/me");
    return { user: data.user, points: mapPoints(data.points), subscription: data.subscription ?? null };
  }

  async updateMe(nickname: string): Promise<ApiUser> {
    return this.request<ApiUser>("/me", {
      method: "PATCH",
      body: JSON.stringify({ nickname })
    });
  }

  async listWorks(): Promise<Work[]> {
    const data = await this.request<ApiWork[]>("/works");
    return data.map(mapWork);
  }

  async createWork(input: string | Partial<WorkDraft> = {}): Promise<Work> {
    const draft: WorkDraft =
      typeof input === "string"
        ? {
            title: input,
            shortIntro: "",
            synopsis: "",
            tags: [],
            backgroundRules: "",
            focusRequirements: "",
            forbiddenRequirements: ""
          }
        : {
            title: input.title ?? "",
            shortIntro: input.shortIntro ?? "",
            synopsis: input.synopsis ?? "",
            tags: input.tags ?? [],
            backgroundRules: input.backgroundRules ?? "",
            focusRequirements: input.focusRequirements ?? "",
            forbiddenRequirements: input.forbiddenRequirements ?? ""
          };
    const data = await this.request<ApiWork>("/works", {
      method: "POST",
      body: JSON.stringify(workPayload(draft))
    });
    return mapWork(data);
  }

  async getWork(id: string): Promise<Work> {
    return mapWork(await this.request<ApiWork>(`/works/${id}`));
  }

  async getWorkspaceBootstrap(workId: string, sessionLimit = 20, messageLimit = 30): Promise<WorkspaceBootstrap> {
    const params = new URLSearchParams({ session_limit: String(sessionLimit), message_limit: String(messageLimit) });
    const data = await this.request<{
      work: ApiWork;
      chapters: ApiChapter[];
      characters: ApiNamedContent[];
      settings: ApiNamedContent[];
      sessions: ApiChatSession[];
      active_session: ApiChatSession;
      messages: {
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          mentions?: ChatMention[];
          references?: ChatReference[];
          actions?: ChatAction[];
          created_at: string;
        }>;
        has_more: boolean;
        next_before: string | null;
      };
      profile: {
        user: ApiUser;
        points: { vip_daily_points_balance: number; credit_pack_points_balance: number };
        subscription?: ApiSubscription | null;
      };
    }>(`/works/${workId}/workspace-bootstrap?${params}`, { method: "POST" });
    return {
      work: mapWork(data.work),
      chapters: data.chapters.map(mapChapter),
      characters: data.characters.map(mapNamedContent),
      settings: data.settings.map(mapNamedContent),
      sessions: data.sessions.map(mapChatSession),
      activeSession: mapChatSession(data.active_session),
      messages: {
        messages: data.messages.messages.map(mapChatMessage),
        hasMore: data.messages.has_more,
        nextBefore: data.messages.next_before
      },
      profile: {
        user: data.profile.user,
        points: mapPoints(data.profile.points),
        subscription: data.profile.subscription ?? null
      }
    };
  }

  async updateWork(work: Work): Promise<Work> {
    const data = await this.request<ApiWork>(`/works/${work.id}`, {
      method: "PATCH",
      body: JSON.stringify(workPayload(work))
    });
    return mapWork(data);
  }

  async deleteWork(workId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/works/${workId}`, {
      method: "DELETE"
    });
  }

  async listChapters(workId: string): Promise<Chapter[]> {
    const data = await this.request<ApiChapter[]>(`/works/${workId}/chapters`);
    return data.map(mapChapter);
  }

  async createChapter(
    workId: string,
    chapter: { title: string; content?: string; summary?: string; order?: number }
  ): Promise<Chapter> {
    const data = await this.request<ApiChapter>(`/works/${workId}/chapters`, {
      method: "POST",
      body: JSON.stringify({
        title: chapter.title,
        content: chapter.content ?? "",
        summary: chapter.summary ?? "",
        order_index: chapter.order
      })
    });
    return mapChapter(data);
  }

  async updateChapter(workId: string, chapter: Chapter): Promise<Chapter> {
    const data = await this.request<ApiChapter>(`/works/${workId}/chapters/${chapter.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary,
        order_index: chapter.order
      })
    });
    return mapChapter(data);
  }

  async deleteChapter(workId: string, chapterId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/works/${workId}/chapters/${chapterId}`, {
      method: "DELETE"
    });
  }

  async analyzeChapter(workId: string, content: string): Promise<ApiSuggestion[]> {
    const data = await this.request<{ suggestions: ApiSuggestion[] }>(`/works/${workId}/analyze`, {
      method: "POST",
      body: JSON.stringify({ content })
    });
    return data.suggestions;
  }

  async listCharacters(workId: string, q?: string): Promise<NamedContent[]> {
    const query = q ? `?q=${encodeURIComponent(q)}` : "";
    const data = await this.request<ApiNamedContent[]>(`/works/${workId}/characters${query}`);
    return data.map(mapNamedContent);
  }

  async createCharacter(workId: string, item: { name: string; summary: string; detail?: string }): Promise<NamedContent> {
    const data = await this.request<ApiNamedContent>(`/works/${workId}/characters`, {
      method: "POST",
      body: JSON.stringify({ name: item.name, summary: item.summary, detail: item.detail ?? "" })
    });
    return mapNamedContent(data);
  }

  async updateCharacter(
    workId: string,
    item: { id: string; name: string; summary: string; detail: string }
  ): Promise<NamedContent> {
    const data = await this.request<ApiNamedContent>(`/works/${workId}/characters/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: item.name, summary: item.summary, detail: item.detail })
    });
    return mapNamedContent(data);
  }

  async deleteCharacter(workId: string, characterId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/works/${workId}/characters/${characterId}`, {
      method: "DELETE"
    });
  }

  async listSettings(workId: string, q?: string, type?: string): Promise<NamedContent[]> {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    const query = params.toString() ? `?${params}` : "";
    const data = await this.request<ApiNamedContent[]>(`/works/${workId}/settings${query}`);
    return data.map(mapNamedContent);
  }

  async createSetting(
    workId: string,
    item: { name: string; summary: string; detail?: string; type?: string }
  ): Promise<NamedContent> {
    const data = await this.request<ApiNamedContent>(`/works/${workId}/settings`, {
      method: "POST",
      body: JSON.stringify({
        name: item.name,
        summary: item.summary,
        detail: item.detail ?? "",
        type: item.type ?? "other"
      })
    });
    return mapNamedContent(data);
  }

  async updateSetting(
    workId: string,
    item: { id: string; name: string; summary: string; detail: string; type?: string }
  ): Promise<NamedContent> {
    const data = await this.request<ApiNamedContent>(`/works/${workId}/settings/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: item.name,
        summary: item.summary,
        detail: item.detail,
        type: item.type ?? "other"
      })
    });
    return mapNamedContent(data);
  }

  async deleteSetting(workId: string, settingId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/works/${workId}/settings/${settingId}`, {
      method: "DELETE"
    });
  }

  async listBillingProducts(): Promise<BillingProducts> {
    const data = await this.request<{
      plans: Array<Parameters<typeof mapProduct>[0]>;
      credit_packs: Array<Parameters<typeof mapProduct>[0]>;
    }>("/billing/products");
    return { plans: data.plans.map(mapProduct), creditPacks: data.credit_packs.map(mapProduct) };
  }

  async createBillingOrder(productType: "plan" | "credit_pack", productId: string): Promise<BillingOrder> {
    const data = await this.request<Parameters<typeof mapOrder>[0]>("/billing/orders", {
      method: "POST",
      body: JSON.stringify({ product_type: productType, product_id: productId })
    });
    return mapOrder(data);
  }

  async getBillingOrder(orderId: string): Promise<BillingOrder> {
    return mapOrder(await this.request<Parameters<typeof mapOrder>[0]>(`/billing/orders/${orderId}`));
  }

  async simulatePaid(orderId: string): Promise<BillingOrder> {
    return mapOrder(await this.request<Parameters<typeof mapOrder>[0]>(`/billing/orders/${orderId}/simulate-paid`, {
      method: "POST"
    }));
  }

  private listQuery(params: AdminListParams = {}): string {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    if (params.productType) search.set("product_type", params.productType);
    if (params.page) search.set("page", String(params.page));
    if (params.pageSize) search.set("page_size", String(params.pageSize));
    return search.toString() ? `?${search}` : "";
  }

  private modelListQuery(params: AdminModelListParams = {}): string {
    const search = new URLSearchParams(this.listQuery(params).replace(/^\?/, ""));
    if (params.logicMin) search.set("logic_min", String(params.logicMin));
    if (params.logicMax) search.set("logic_max", String(params.logicMax));
    if (params.contextMin) search.set("context_min", String(params.contextMin));
    if (params.contextMax) search.set("context_max", String(params.contextMax));
    if (params.outputMin) search.set("output_min", String(params.outputMin));
    if (params.outputMax) search.set("output_max", String(params.outputMax));
    return search.toString() ? `?${search}` : "";
  }

  async listAiModels(): Promise<AiModelOption[]> {
    return this.request<AiModelOption[]>("/ai/models");
  }

  async listAdminUsers(params: string | AdminListParams = {}): Promise<Paginated<AdminUserListItem>> {
    const normalized = typeof params === "string" ? { q: params } : params;
    return this.request<Paginated<AdminUserListItem>>(`/admin/users${this.listQuery(normalized)}`);
  }

  async getAdminUser(userId: string): Promise<UserProfile> {
    const data = await this.request<{
      user: ApiUser;
      points: { vip_daily_points_balance: number; credit_pack_points_balance: number };
      subscription?: ApiSubscription | null;
    }>(`/admin/users/${userId}`);
    return { user: data.user, points: mapPoints(data.points), subscription: data.subscription ?? null };
  }

  async updateAdminUser(userId: string, input: { nickname?: string; status?: string }): Promise<ApiUser> {
    return this.request<ApiUser>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  async adminAdjustBalance(userId: string, input: AdminBalanceAdjustInput): Promise<AdminBalanceAdjustResult> {
    return this.request<AdminBalanceAdjustResult>(`/admin/users/${userId}/balance`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async listAdminModels(params: AdminModelListParams = {}): Promise<Paginated<AdminAiModel>> {
    return this.request<Paginated<AdminAiModel>>(`/admin/models${this.modelListQuery(params)}`);
  }

  async createAdminModel(input: AdminAiModelInput): Promise<AdminAiModel> {
    return this.request<AdminAiModel>("/admin/models", {
      method: "POST",
      body: JSON.stringify(aiModelPayload(input))
    });
  }

  async updateAdminModel(modelId: string, input: AdminAiModelInput): Promise<AdminAiModel> {
    return this.request<AdminAiModel>(`/admin/models/${modelId}`, {
      method: "PATCH",
      body: JSON.stringify(aiModelPayload(input))
    });
  }

  async listAdminProducts(): Promise<{
    plans: Array<Record<string, unknown>>;
    credit_packs: Array<Record<string, unknown>>;
  }> {
    return this.request("/admin/products");
  }

  async listAdminProductsPage(
    kind: AdminProductKind,
    params: AdminListParams = {}
  ): Promise<Paginated<Record<string, unknown> & { id: string; name: string; status: string }>> {
    const search = new URLSearchParams(this.listQuery(params).replace(/^\?/, ""));
    search.set("kind", kind);
    return this.request(`/admin/products?${search}`);
  }

  async createAdminProduct(kind: AdminProductKind, input: AdminProductInput): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/admin/products/${kind}`, {
      method: "POST",
      body: JSON.stringify(productPayload(input))
    });
  }

  async updateAdminProduct(kind: AdminProductKind, itemId: string, input: AdminProductInput): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(`/admin/products/${kind}/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify(productPayload(input))
    });
  }

  async deleteAdminProduct(kind: AdminProductKind, itemId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/admin/products/${kind}/${itemId}`, { method: "DELETE" });
  }

  async listAdminCreditTransactions(params: CreditTransactionListParams = {}): Promise<Paginated<AdminCreditTransaction>> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.balance_type) search.set("balance_type", params.balance_type);
    if (params.change_type) search.set("change_type", params.change_type);
    if (params.source_type) search.set("source_type", params.source_type);
    if (params.model_id) search.set("model_id", params.model_id);
    if (params.work_id) search.set("work_id", params.work_id);
    if (params.points_min != null) search.set("points_min", String(params.points_min));
    if (params.points_max != null) search.set("points_max", String(params.points_max));
    if (params.time_from) search.set("time_from", params.time_from);
    if (params.time_to) search.set("time_to", params.time_to);
    if (params.page) search.set("page", String(params.page));
    if (params.pageSize) search.set("page_size", String(params.pageSize));
    return this.request<Paginated<AdminCreditTransaction>>(`/admin/credit-transactions${search.toString() ? `?${search}` : ""}`);
  }

  async getAdminCreditTransaction(id: string): Promise<AdminCreditTransaction> {
    return this.request<AdminCreditTransaction>(`/admin/credit-transactions/${id}`);
  }

  async listAdminOrders(params: AdminListParams = {}): Promise<Paginated<AdminOrder>> {
    return this.request<Paginated<AdminOrder>>(`/admin/orders${this.listQuery(params)}`);
  }

  async getAdminOrder(orderId: string): Promise<{
    order: AdminOrder;
    payments: Array<Record<string, unknown>>;
    grants: Array<Record<string, unknown>>;
  }> {
    return this.request(`/admin/orders/${orderId}`);
  }

  async listAdminSubscriptions(params: AdminListParams = {}): Promise<Paginated<AdminSubscription>> {
    return this.request<Paginated<AdminSubscription>>(`/admin/subscriptions${this.listQuery(params)}`);
  }

  async getAdminSubscription(subscriptionId: string): Promise<{
    subscription: AdminSubscription;
    user: ApiUser;
    plan: Record<string, unknown>;
    order: AdminOrder | null;
  }> {
    return this.request(`/admin/subscriptions/${subscriptionId}`);
  }

  async listAdminSessions(params: string | AdminListParams = {}): Promise<Paginated<AdminSession>> {
    const normalized = typeof params === "string" ? { q: params } : params;
    return this.request<Paginated<AdminSession>>(`/admin/sessions${this.listQuery(normalized)}`);
  }

  async getAdminSession(sessionId: string): Promise<{
    session: AdminSession;
    agent: { runs?: ChatMessage[] | Array<Record<string, unknown>> } | null;
  }> {
    return this.request(`/admin/sessions/${sessionId}`);
  }

  async listAdminConfigs(params: string | { group?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<AdminConfig>> {
    const normalized = typeof params === "string" ? { group: params } : params;
    const search = new URLSearchParams();
    if (normalized.group) search.set("group", normalized.group);
    if (normalized.page) search.set("page", String(normalized.page));
    if (normalized.pageSize) search.set("page_size", String(normalized.pageSize));
    return this.request<Paginated<AdminConfig>>(`/admin/configs${search.toString() ? `?${search}` : ""}`);
  }

  async updateAdminConfig(configId: string, input: AdminConfigValue): Promise<AdminConfig> {
    return this.request<AdminConfig>(`/admin/configs/${configId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  async listChatSessions(workId: string, limit = 20): Promise<ChatSession[]> {
    const data = await this.request<ApiChatSession[]>(`/works/${workId}/chat-sessions?limit=${limit}`);
    return data.map(mapChatSession);
  }

  async createChatSession(workId: string, title = "新的对话", sourceType = "manual"): Promise<ChatSession> {
    const data = await this.request<ApiChatSession>(`/works/${workId}/chat-sessions`, {
      method: "POST",
      body: JSON.stringify({ title, source_type: sourceType })
    });
    return mapChatSession(data);
  }

  async listChatMessages(sessionId: string, limit = 30, before?: string | null): Promise<ChatMessagePage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) {
      params.set("before", before);
    }
    const data = await this.request<{
      messages: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        mentions?: ChatMention[];
        references?: ChatReference[];
        actions?: ChatAction[];
        created_at: string;
      }>;
      has_more: boolean;
      next_before: string | null;
    }>(`/chat-sessions/${sessionId}/messages?${params}`);
    return {
      messages: data.messages.map(mapChatMessage),
      hasMore: data.has_more,
      nextBefore: data.next_before
    };
  }

  async streamChatMessage(
    sessionId: string,
    message: string,
    references: ChatReference[],
    mentions: ChatMention[],
    onChunk: (chunk: string) => void,
    modelId?: string,
    onToolCall?: (tool: string, status: "started" | "completed", data?: { display?: string; result?: string }) => void,
    onError?: (message: string) => void,
    signal?: AbortSignal
  ): Promise<ChatMessage> {
    const response = await this.rawRequest(`/chat-sessions/${sessionId}/messages`, {
      signal,
      method: "POST",
      body: JSON.stringify({ message, references, mentions, ...(modelId ? { model_id: modelId } : {}) })
    });
    if (!response.body) {
      throw new ApiError("stream body unavailable", response.status);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalMessage: ChatMessage | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() as string;
      for (const eventText of events) {
        const event = parseSseEvent(eventText);
        if (!event.data) {
          continue;
        }
        if (event.event === "done") {
          finalMessage = mapChatMessage(JSON.parse(event.data));
        } else if (event.event === "error") {
          try {
            const errorData = JSON.parse(event.data);
            if (onError && errorData.message) {
              onError(errorData.message);
            }
          } catch {
            // Ignore malformed error events
          }
        } else if (event.event === "tool_call" || event.event === "tool_result") {
          try {
            const toolData = JSON.parse(event.data);
            if (onToolCall && toolData.tool) {
              onToolCall(toolData.tool, toolData.status, event.event === "tool_result" ? { display: toolData.display, result: toolData.result } : undefined);
            }
          } catch {
            // Ignore malformed tool events
          }
        } else {
          onChunk(event.data);
        }
      }
    }

    if (buffer.trim()) {
      const event = parseSseEvent(buffer);
      if (event.event === "done" && event.data) {
        finalMessage = mapChatMessage(JSON.parse(event.data));
      } else if (event.event === "error") {
        try {
          const errorData = JSON.parse(event.data!);
          if (onError && errorData.message) {
            onError(errorData.message);
          }
        } catch {
          // Ignore malformed error events
        }
      } else if (event.event === "tool_call" || event.event === "tool_result") {
        try {
          const toolData = JSON.parse(event.data!);
          if (onToolCall && toolData.tool) {
            onToolCall(toolData.tool, toolData.status, event.event === "tool_result" ? { display: toolData.display, result: toolData.result } : undefined);
          }
        } catch {
          // Ignore malformed tool events
        }
      }
    }

    if (!finalMessage) {
      throw new ApiError("missing final assistant message", response.status);
    }
    return finalMessage;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.rawRequest(path, init);
    return (await response.json()) as T;
  }

  private async fetchCsrfToken(forceRefresh = false): Promise<string> {
    if (this.csrfToken && !forceRefresh) {
      return this.csrfToken;
    }
    const cookieToken = csrfCookieToken();
    if (cookieToken && !forceRefresh) {
      this.csrfToken = cookieToken;
      return this.csrfToken;
    }
    const response = await this.fetcher(`${normalizeBaseUrl(this.baseUrl)}/csrf`, {
      cache: "no-store",
      credentials: "include"
    });
    if (!response.ok) {
      throw new ApiError(await response.text(), response.status);
    }
    const data = (await response.json()) as { csrf_token?: string };
    if (!data.csrf_token) {
      throw new ApiError("missing csrf token", response.status);
    }
    this.csrfToken = data.csrf_token;
    return this.csrfToken;
  }

  private async rawRequest(path: string, init: RequestInit = {}, retriedCsrf = false): Promise<Response> {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    const method = (init.method ?? "GET").toUpperCase();
    const needsCsrf = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    if (needsCsrf) {
      headers.set("X-CSRF-Token", await this.fetchCsrfToken(retriedCsrf));
    }
    const response = await this.fetcher(`${normalizeBaseUrl(this.baseUrl)}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "include"
    });
    if (!response.ok) {
      const message = await response.text();
      if (needsCsrf && response.status === 403 && !retriedCsrf && message.toLowerCase().includes("csrf")) {
        this.csrfToken = null;
        return this.rawRequest(path, init, true);
      }
      throw new ApiError(message, response.status);
    }
    return response;
  }
}

function parseSseEvent(text: string): { event: string | null; data: string } {
  let event: string | null = null;
  const data: string[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }
  return { event, data: data.join("\n") };
}
