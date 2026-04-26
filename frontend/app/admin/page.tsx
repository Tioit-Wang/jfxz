import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AdminHeading, AdminPage, AdminPanel } from "./_components";

export default function AdminHome() {
  return (
    <AdminPage>
      <AdminHeading
        title="后台概览"
        description="用于确认管理后台的边界、风险关注点和日常处理节奏；具体业务操作由左侧导航进入。"
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <AdminPanel title="今日工作台" description="概览页只承载管理上下文，不放置功能入口。">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">用户与权限</Badge>
              <Badge variant="outline">商品与订单</Badge>
              <Badge variant="outline">订阅与积分</Badge>
              <Badge variant="outline">会话审计</Badge>
              <Badge variant="outline">系统配置</Badge>
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-2">
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium">处理原则</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  优先处理会影响用户登录、支付、订阅权益和积分发放的问题；涉及配置变更时先确认影响范围，再保存。
                </p>
              </section>
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-medium">审计视角</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  订单、订阅和会话页面保持只读优先，详情抽屉用于追溯上下文，避免在列表中暴露过多噪声。
                </p>
              </section>
            </div>
          </div>
        </AdminPanel>
        <AdminPanel title="界面约定" description="管理端保持低干扰、强可读、少统计的操作体验。">
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>列表页以筛选、表格和详情面板为核心。</p>
            <p>配置页按分组标签切换，敏感值默认掩码展示。</p>
            <p>破坏性动作进入确认流程，普通查看动作放在行尾。</p>
          </div>
        </AdminPanel>
      </div>
    </AdminPage>
  );
}
