export type Work = {
  id: string;
  title: string;
  shortIntro: string;
  synopsis: string;
  backgroundRules: string;
  focusRequirements: string;
  forbiddenRequirements: string;
  tags: string[];
  updatedAt: string;
};

export type Chapter = {
  id: string;
  order: number;
  title: string;
  summary: string;
  content: string;
};

export type Suggestion = {
  quote: string;
  replacement: string;
};

export type AdminUser = {
  email: string;
  nickname: string;
  status: "active" | "disabled";
};

export type ConfigItem = {
  key: string;
  type: "string" | "secret" | "boolean";
  value: string;
};

export const works: Work[] = [
  {
    id: "book-1",
    title: "雾港纪事",
    shortIntro: "一座雾中港城的长篇奇幻故事。",
    synopsis: "灯塔异常揭开港城潮汐账本的秘密。",
    backgroundRules: "雾港的潮汐被商会记录和控制。",
    focusRequirements: "强调潮湿、账本和灯塔的压迫感。",
    forbiddenRequirements: "避免突然转成轻松冒险喜剧。",
    tags: ["奇幻", "群像"],
    updatedAt: ""
  },
  {
    id: "book-2",
    title: "星桥来信",
    shortIntro: "星际航道断裂后的书信体冒险。",
    synopsis: "断裂星桥两端的人用信件重新确认彼此。",
    backgroundRules: "星桥只能在固定周期短暂连通。",
    focusRequirements: "保持书信体带来的距离与延迟。",
    forbiddenRequirements: "避免万能通讯设备破坏核心设定。",
    tags: ["科幻", "冒险"],
    updatedAt: ""
  }
];

export const chapters: Chapter[] = [
  {
    id: "chapter-1",
    order: 1,
    title: "第一章 雾灯",
    summary: "主角抵达港口，第一次发现灯塔异常。",
    content: "雾像未寄出的信，压在港口的每一盏灯上。\n她在钟声里抬头，看见灯塔亮了三次。"
  },
  {
    id: "chapter-2",
    order: 2,
    title: "第二章 潮汐账本",
    summary: "旧账本揭开商会与失踪潮汐的关系。",
    content: "账本边缘潮湿发皱，最后一页只有一个被划掉的名字。"
  }
];

export const adminUsers: AdminUser[] = [
  { email: "writer@example.com", nickname: "长篇作者", status: "active" },
  { email: "paused@example.com", nickname: "暂停用户", status: "disabled" }
];

export const configs: ConfigItem[] = [
  { key: "payment.alipay_f2f.enabled", type: "boolean", value: "false" },
  { key: "payment.alipay_f2f.app_private_key", type: "secret", value: "dev-secret-key" }
];

export function wordCount(content: string): number {
  return [...content.replace(/\s/g, "")].length;
}

export function searchUsers(users: AdminUser[], keyword: string): AdminUser[] {
  const q = keyword.trim().toLowerCase();
  if (!q) {
    return users;
  }
  return users.filter((user) => user.email.includes(q) || user.nickname.toLowerCase().includes(q));
}

export function maskConfig(item: ConfigItem, reveal: boolean): string {
  if (item.type !== "secret" || reveal) {
    return item.value;
  }
  return item.value ? "******" : "";
}

export function applySuggestion(content: string, suggestion: Suggestion): string {
  return content.includes(suggestion.quote)
    ? content.replace(suggestion.quote, suggestion.replacement)
    : content;
}

export function getWork(id: string): Work {
  return works.find((work) => work.id === id) ?? works[0];
}
