import type { Chapter, ChapterVersion, Work } from "./domain";

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
  share_enabled?: boolean;
  share_token?: string | null;
  updated_at?: string | null;
};

export type ShareStatus = {
  share_enabled: boolean;
  share_token: string | null;
};

export type PublicWorkInfo = {
  title: string;
  short_intro: string;
};

export type ApiChapter = {
  id: string;
  volume_id?: string | null;
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

export type ApiChapterVersion = {
  id: string;
  version_number: number;
  title: string;
  content?: string;
  summary?: string | null;
  source: "human" | "ai";
  source_detail: string | null;
  word_count: number;
  created_at: string | null;
  updated_at: string | null;
  is_current: boolean;
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

export type ApiInspirationNote = {
  id: string;
  work_id: string;
  title: string;
  content: string;
  category: string;
  updated_at?: string | null;
};

export type ApiVolume = {
  id: string;
  work_id: string;
  title: string;
  order_index: number;
  updated_at?: string | null;
};

export type ApiWritingGoal = {
  id: string;
  work_id: string;
  target_words: number;
  updated_at?: string | null;
};

export type ApiDailyWordProgress = {
  id?: string;
  work_id?: string;
  date: string;
  words_added: number;
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

export type InspirationNote = {
  id: string;
  title: string;
  content: string;
  category: string;
  updatedAt: string;
};

export type Volume = {
  id: string;
  title: string;
  order: number;
  updatedAt: string;
};

export type WritingGoal = {
  id: string;
  targetWords: number;
  updatedAt: string;
};

export type DailyWordProgress = {
  date: string;
  wordsAdded: number;
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
  range?: string;
};

export type ChatAction = {
  type: "save_character" | "save_setting" | "update_chapter" | "update_work_info";
  label: string;
};

export type TextBlock = { type: "text"; text: string };

export type ToolCallBlock = {
  type: "tool_call";
  tool: string;
  display: string;
  status: "started" | "completed" | "error";
  result?: string;
};

export type ContentBlock = TextBlock | ToolCallBlock;

type ApiContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string; display: string; status: "started" | "completed" | "error"; result?: string };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  blocks?: ContentBlock[];
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
  volumes: Volume[];
  chapters: Chapter[];
  characters: NamedContent[];
  settings: NamedContent[];
  inspirationNotes: InspirationNote[];
  writingGoal: WritingGoal;
  dailyWordProgress: DailyWordProgress;
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

export type CostPreviewIn = {
  modelId: string;
  bundledCreditPackPoints: number;
  dailyVipPoints: number;
  durationDays?: number;
  priceAmount?: string;
};

export type CostPreviewScenario = {
  utilizationPct: number;
  vipPointsUsed: number;
  vipCost: number;
  totalCost: number;
  revenue: number | null;
  profit: number | null;
  marginPct: number | null;
};

export type CostPreviewOut = {
  model: {
    id: string;
    displayName: string;
    inputCostPerMillion: number;
    cacheHitInputCostPerMillion: number;
    outputCostPerMillion: number;
    profitMultiplier: number;
  };
  perPoint: {
    blendedCost: number;
    inputCost: number;
    outputCost: number;
    tokensPerPointOutput: number;
    tokensPerPointInput: number;
    note: string;
  };
  creditPack: { points: number; cashCost: number; costVsPricePct: string | null };
  dailyVip: { pointsPerDay: number; monthlyPointsMax: number; monthlyCostMax: number };
  scenarios: CostPreviewScenario[];
  conclusion: {
    creditPackExceedsPrice: boolean;
    minTotalCost: number;
    breakevenUtilization: number | null;
    suggestedMaxBundled: number | null;
    warning: string;
  };
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
  temperature: string;
  status: "active" | "inactive";
  sort_order: number | null;
};

export type AdminAiModel = AiModelOption & {
  provider_model_id: string;
  input_cost_per_million: string;
  cache_hit_input_cost_per_million: string;
  output_cost_per_million: string;
  profit_multiplier: string;
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
  inputCostPerMillion: string;
  cacheHitInputCostPerMillion: string;
  outputCostPerMillion: string;
  profitMultiplier: string;
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
  input_cost_per_million_snapshot?: string;
  cache_hit_input_cost_per_million_snapshot?: string;
  output_cost_per_million_snapshot?: string;
  profit_multiplier_snapshot?: string;
  points_per_cny_snapshot?: string;
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
  daily_vip_points_snapshot: number;
  duration_days_snapshot: number;
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

export type StatsPeriod = {
  from: string | null;
  to: string | null;
};

export type TimeSeriesStats = {
  total_tokens: number;
  cache_hit_tokens: number;
  cache_miss_tokens: number;
  completion_tokens: number;
  points_consumed: number;
  total_words: number;
  ai_words: number;
  human_words: number;
  ai_conversations: number;
  total_revenue: number;
  new_users: number;
};

export type StatsTrend = Record<string, number | null>;

export type DailyPoint = {
  date: string;
  tokens: number;
  points: number;
};

export type AdminStats = TimeSeriesStats & {
  active_users: number;
  active_subscriptions: number;
  total_works: number;
  period: StatsPeriod;
  previous: TimeSeriesStats | null;
  trend: StatsTrend | null;
  daily: DailyPoint[] | null;
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
    .find((part) => part.startsWith("goodgua_csrf="));
  return cookie ? decodeURIComponent(cookie.slice("goodgua_csrf=".length)) : null;
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
    shareEnabled: work.share_enabled ?? false,
    shareToken: work.share_token ?? null,
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
    volumeId: chapter.volume_id ?? undefined,
    order: chapter.order_index,
    title: chapter.title,
    summary: chapter.summary ?? "",
    content: chapter.content
  };
}

export function mapChapterVersion(v: ApiChapterVersion): ChapterVersion {
  return {
    id: v.id,
    versionNumber: v.version_number,
    title: v.title,
    content: v.content,
    summary: v.summary,
    source: v.source,
    sourceDetail: v.source_detail,
    wordCount: v.word_count,
    createdAt: v.created_at ?? "",
    updatedAt: v.updated_at ?? "",
    isCurrent: v.is_current,
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

export function mapInspirationNote(item: ApiInspirationNote): InspirationNote {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    category: item.category,
    updatedAt: item.updated_at ?? ""
  };
}

export function mapVolume(item: ApiVolume): Volume {
  return {
    id: item.id,
    title: item.title,
    order: item.order_index,
    updatedAt: item.updated_at ?? ""
  };
}

export function mapWritingGoal(item: ApiWritingGoal): WritingGoal {
  return {
    id: item.id,
    targetWords: item.target_words,
    updatedAt: item.updated_at ?? ""
  };
}

export function mapDailyWordProgress(item: ApiDailyWordProgress): DailyWordProgress {
  return {
    date: item.date,
    wordsAdded: item.words_added,
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
    input_cost_per_million: input.inputCostPerMillion,
    cache_hit_input_cost_per_million: input.cacheHitInputCostPerMillion,
    output_cost_per_million: input.outputCostPerMillion,
    profit_multiplier: input.profitMultiplier,
    status: input.status,
    sort_order: input.sortOrder ?? null
  };
}

function normalizeContentBlocks(blocks?: ApiContentBlock[]): ContentBlock[] | undefined {
  if (!blocks?.length) return undefined;
  const normalized: ContentBlock[] = [];
  for (const block of blocks) {
    if (block.type === "text") {
      if (block.text) {
        normalized.push({ type: "text", text: block.text });
      }
      continue;
    }
    normalized.push({
      type: "tool_call",
      tool: block.tool,
      display: block.display,
      status: block.status,
      ...(block.result !== undefined ? { result: block.result } : {}),
    });
  }
  return normalized.length ? normalized : undefined;
}

function mapChatMessage(message: {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: ChatAction[];
  created_at: string;
  billing_failed?: boolean;
  error?: string | null;
  blocks?: ApiContentBlock[];
}): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    blocks: normalizeContentBlocks(message.blocks),
    actions: message.actions ?? [],
    createdAt: message.created_at,
    billing_failed: message.billing_failed,
    error: message.error ?? undefined,
  };
}

export type ApiClientOptions = {
  onUnauthorized?: () => void;
};

export class ApiClient {
  private csrfToken: string | null = null;
  private readonly onUnauthorized?: () => void;

  constructor(
    private readonly baseUrl = defaultApiBaseUrl(),
    private readonly fetcher: Fetcher = (...args) => fetch(...args),
    options?: ApiClientOptions
  ) {
    this.onUnauthorized = options?.onUnauthorized;
  }

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
      volumes: ApiVolume[];
      chapters: ApiChapter[];
      characters: ApiNamedContent[];
      settings: ApiNamedContent[];
      inspiration_notes: ApiInspirationNote[];
      writing_goal: ApiWritingGoal;
      daily_word_progress: ApiDailyWordProgress;
      sessions: ApiChatSession[];
      active_session: ApiChatSession;
      messages: {
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          blocks?: ApiContentBlock[];
          actions?: ChatAction[];
          created_at: string;
          billing_failed?: boolean;
          error?: string | null;
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
      volumes: data.volumes.map(mapVolume),
      chapters: data.chapters.map(mapChapter),
      characters: data.characters.map(mapNamedContent),
      settings: data.settings.map(mapNamedContent),
      inspirationNotes: data.inspiration_notes.map(mapInspirationNote),
      writingGoal: mapWritingGoal(data.writing_goal),
      dailyWordProgress: mapDailyWordProgress(data.daily_word_progress),
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

  async previewChapters(workId: string, around?: string, limit = 5, direction?: "after" | "before"): Promise<{ chapters: Chapter[]; total: number; aroundIndex: number | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (around) params.set("around", around);
    if (direction) params.set("direction", direction);
    const data = await this.request<{ chapters: ApiChapter[]; total: number; around_index: number | null }>(
      `/works/${workId}/preview?${params}`
    );
    return {
      chapters: data.chapters.map(mapChapter),
      total: data.total,
      aroundIndex: data.around_index,
    };
  }

  async getShareStatus(workId: string): Promise<ShareStatus> {
    return this.request<ShareStatus>(`/works/${workId}/share`);
  }

  async toggleShare(workId: string, shareEnabled: boolean): Promise<ShareStatus> {
    return this.request<ShareStatus>(`/works/${workId}/share`, {
      method: "PATCH",
      body: JSON.stringify({ share_enabled: shareEnabled }),
    });
  }

  async publicPreviewChapters(
    shareToken: string,
    around?: string,
    limit = 5,
    direction?: "after" | "before",
  ): Promise<{ work: { title: string; shortIntro: string }; chapters: Chapter[]; total: number; aroundIndex: number | null }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (around) params.set("around", around);
    if (direction) params.set("direction", direction);
    const data = await this.request<{
      work: { title: string; short_intro: string };
      chapters: ApiChapter[];
      total: number;
      around_index: number | null;
    }>(`/public/${shareToken}/preview?${params}`);
    return {
      work: { title: data.work.title, shortIntro: data.work.short_intro },
      chapters: data.chapters.map(mapChapter),
      total: data.total,
      aroundIndex: data.around_index,
    };
  }

  async createChapter(
    workId: string,
    chapter: { title: string; content?: string; summary?: string; order?: number; volumeId?: string; wordsAdded?: number }
  ): Promise<Chapter> {
    const data = await this.request<ApiChapter>(`/works/${workId}/chapters`, {
      method: "POST",
      body: JSON.stringify({
        title: chapter.title,
        content: chapter.content ?? "",
        summary: chapter.summary ?? "",
        order_index: chapter.order,
        volume_id: chapter.volumeId,
        words_added: chapter.wordsAdded
      })
    });
    return mapChapter(data);
  }

  async updateChapter(workId: string, chapter: Chapter, wordsAdded?: number): Promise<Chapter> {
    const data = await this.request<ApiChapter>(`/works/${workId}/chapters/${chapter.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary,
        order_index: chapter.order,
        volume_id: chapter.volumeId,
        words_added: wordsAdded
      })
    });
    return mapChapter(data);
  }

  async createVolume(workId: string, title: string): Promise<Volume> {
    const data = await this.request<ApiVolume>(`/works/${workId}/volumes`, {
      method: "POST",
      body: JSON.stringify({ title })
    });
    return mapVolume(data);
  }

  async updateVolume(workId: string, volumeId: string, title: string): Promise<Volume> {
    const data = await this.request<ApiVolume>(`/works/${workId}/volumes/${volumeId}`, {
      method: "PATCH",
      body: JSON.stringify({ title })
    });
    return mapVolume(data);
  }

  async deleteVolume(workId: string, volumeId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/works/${workId}/volumes/${volumeId}`, {
      method: "DELETE"
    });
  }

  async reorderChapters(workId: string, chapters: { id: string; volumeId: string }[]): Promise<void> {
    await this.request<{ ok: boolean }>(`/works/${workId}/chapters/reorder`, {
      method: "POST",
      body: JSON.stringify({ chapters: chapters.map((c) => ({ id: c.id, volume_id: c.volumeId })) })
    });
  }

  async deleteChapter(workId: string, chapterId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/works/${workId}/chapters/${chapterId}`, {
      method: "DELETE"
    });
  }

  async listChapterVersions(
    workId: string,
    chapterId: string,
    options?: { limit?: number; cursor?: number }
  ): Promise<{ items: ChapterVersion[]; total: number; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.cursor) params.set("cursor", String(options.cursor));
    const qs = params.toString();
    const data = await this.request<{ items: ApiChapterVersion[]; total: number; has_more: boolean }>(
      `/works/${workId}/chapters/${chapterId}/versions${qs ? `?${qs}` : ""}`
    );
    return { items: data.items.map(mapChapterVersion), total: data.total, hasMore: data.has_more };
  }

  async getChapterVersion(workId: string, chapterId: string, versionId: string): Promise<ChapterVersion> {
    const data = await this.request<ApiChapterVersion>(
      `/works/${workId}/chapters/${chapterId}/versions/${versionId}`
    );
    return mapChapterVersion(data);
  }

  async restoreChapterVersion(
    workId: string,
    chapterId: string,
    versionId: string
  ): Promise<ChapterVersion> {
    const data = await this.request<ApiChapterVersion>(
      `/works/${workId}/chapters/${chapterId}/versions/${versionId}/restore`,
      { method: "POST" }
    );
    return mapChapterVersion(data);
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

  async listInspirationNotes(workId: string): Promise<InspirationNote[]> {
    const data = await this.request<ApiInspirationNote[]>(`/works/${workId}/inspiration-notes`);
    return data.map(mapInspirationNote);
  }

  async createInspirationNote(
    workId: string,
    item: { title: string; content?: string; category?: string }
  ): Promise<InspirationNote> {
    const data = await this.request<ApiInspirationNote>(`/works/${workId}/inspiration-notes`, {
      method: "POST",
      body: JSON.stringify({
        title: item.title,
        content: item.content ?? "",
        category: item.category ?? "灵感"
      })
    });
    return mapInspirationNote(data);
  }

  async updateInspirationNote(
    workId: string,
    item: { id: string; title: string; content: string; category?: string }
  ): Promise<InspirationNote> {
    const data = await this.request<ApiInspirationNote>(`/works/${workId}/inspiration-notes/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: item.title,
        content: item.content,
        category: item.category ?? "灵感"
      })
    });
    return mapInspirationNote(data);
  }

  async deleteInspirationNote(workId: string, noteId: string): Promise<void> {
    await this.request<{ ok: boolean }>(`/works/${workId}/inspiration-notes/${noteId}`, {
      method: "DELETE"
    });
  }

  async updateWritingGoal(
    workId: string,
    item: { targetWords: number }
  ): Promise<{ goal: WritingGoal; dailyWordProgress: DailyWordProgress }> {
    const data = await this.request<{ goal: ApiWritingGoal; daily_word_progress: ApiDailyWordProgress }>(
      `/works/${workId}/writing-goal`,
      {
        method: "PATCH",
        body: JSON.stringify({
          target_words: item.targetWords
        })
      }
    );
    return { goal: mapWritingGoal(data.goal), dailyWordProgress: mapDailyWordProgress(data.daily_word_progress) };
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

  async previewPlanCost(input: CostPreviewIn): Promise<CostPreviewOut> {
    const raw = await this.request<Record<string, unknown>>("/admin/cost-preview", {
      method: "POST",
      body: JSON.stringify({
        model_id: input.modelId,
        bundled_credit_pack_points: input.bundledCreditPackPoints,
        daily_vip_points: input.dailyVipPoints,
        duration_days: input.durationDays ?? 31,
        price_amount: input.priceAmount ?? null,
      }),
    });
    const m = raw.model as Record<string, unknown>;
    const pp = raw.per_point as Record<string, unknown>;
    const cp = raw.credit_pack as Record<string, unknown>;
    const dv = raw.daily_vip as Record<string, unknown>;
    const rawScenarios = raw.scenarios as Array<Record<string, unknown>>;
    const conc = raw.conclusion as Record<string, unknown>;
    return {
      model: {
        id: m.id as string,
        displayName: m.display_name as string,
        inputCostPerMillion: m.input_cost_per_million as number,
        cacheHitInputCostPerMillion: m.cache_hit_input_cost_per_million as number,
        outputCostPerMillion: m.output_cost_per_million as number,
        profitMultiplier: m.profit_multiplier as number,
      },
      perPoint: {
        blendedCost: pp.blended_cost as number,
        inputCost: pp.input_cost as number,
        outputCost: pp.output_cost as number,
        tokensPerPointOutput: pp.tokens_per_point_output as number,
        tokensPerPointInput: pp.tokens_per_point_input as number,
        note: pp.note as string,
      },
      creditPack: {
        points: cp.points as number,
        cashCost: cp.cash_cost as number,
        costVsPricePct: cp.cost_vs_price_pct as string | null,
      },
      dailyVip: {
        pointsPerDay: dv.points_per_day as number,
        monthlyPointsMax: dv.monthly_points_max as number,
        monthlyCostMax: dv.monthly_cost_max as number,
      },
      scenarios: rawScenarios.map((s) => ({
        utilizationPct: s.utilization_pct as number,
        vipPointsUsed: s.vip_points_used as number,
        vipCost: s.vip_cost as number,
        totalCost: s.total_cost as number,
        revenue: (s.revenue as number) ?? null,
        profit: (s.profit as number) ?? null,
        marginPct: (s.margin_pct as number) ?? null,
      })),
      conclusion: {
        creditPackExceedsPrice: conc.credit_pack_exceeds_price as boolean,
        minTotalCost: conc.min_total_cost as number,
        breakevenUtilization: (conc.breakeven_utilization as number) ?? null,
        suggestedMaxBundled: (conc.suggested_max_bundled as number) ?? null,
        warning: conc.warning as string,
      },
    };
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

  async getAdminStats(timeFrom?: string, timeTo?: string): Promise<AdminStats> {
    const params = new URLSearchParams();
    if (timeFrom) params.set("time_from", timeFrom);
    if (timeTo) params.set("time_to", timeTo);
    const qs = params.toString();
    return this.request<AdminStats>(`/admin/stats${qs ? "?" + qs : ""}`);
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
        blocks?: ApiContentBlock[];
        actions?: ChatAction[];
        created_at: string;
        billing_failed?: boolean;
        error?: string | null;
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
    onChunk: (chunk: string) => void,
    modelId?: string,
    thinkingIntensity?: number,
    onToolCall?: (tool: string, status: "started" | "completed", data?: { display?: string; result?: string }) => void,
    onError?: (message: string) => void,
    signal?: AbortSignal
  ): Promise<ChatMessage> {
    const response = await this.rawRequest(`/chat-sessions/${sessionId}/messages`, {
      signal,
      method: "POST",
      body: JSON.stringify({
        message,
        ...(modelId ? { model_id: modelId } : {}),
        ...(thinkingIntensity !== undefined ? { thinking_intensity: thinkingIntensity } : {}),
      })
    });
    if (!response.body) {
      throw new ApiError("stream body unavailable", response.status);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalMessage: ChatMessage | null = null;

    try {
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
            try {
              const parsed = JSON.parse(event.data);
              if (parsed && parsed.id) {
                finalMessage = mapChatMessage(parsed);
              }
            } catch {
              // Malformed done event — will be caught by the finalMessage null check below
            }
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
          } else if (event.event === "text" || event.event === null) {
            const text = parseSseText(event.data);
            if (text !== null) {
              onChunk(text);
            }
          }
        }
      }

      if (buffer.trim()) {
        const event = parseSseEvent(buffer);
        if (event.event === "done" && event.data) {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && parsed.id) {
              finalMessage = mapChatMessage(parsed);
            }
          } catch {
            // Malformed done event
          }
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
        } else if ((event.event === "text" || event.event === null) && event.data) {
          const text = parseSseText(event.data);
          if (text !== null) {
            onChunk(text);
          }
        }
      }

      if (!finalMessage) {
        if (signal?.aborted) {
          throw new DOMException("aborted", "AbortError");
        }
        throw new ApiError("missing final assistant message", response.status);
      }
      return finalMessage;
    } finally {
      try { reader.releaseLock(); } catch { /* best-effort */ }
    }
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
      if (response.status === 401 && this.onUnauthorized) {
        this.onUnauthorized();
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

function parseSseText(data: string): string | null {
  try {
    const text = JSON.parse(data);
    return typeof text === "string" ? text : null;
  } catch {
    return data;
  }
}
