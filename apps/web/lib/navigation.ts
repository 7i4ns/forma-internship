// Add a route here and its page under app/(workspace) to extend the navigation.
export const navigation = [
  { label: 'Dashboard', href: '/dashboard', symbol: '◫', description: '工作台概览' },
  { label: 'Company', href: '/company', symbol: '▥', description: '公司管理' },
  { label: 'Order', href: '/order', symbol: '▤', description: '订单管理' },
  { label: 'Agent Tasks', href: '/agent-tasks', symbol: '✧', description: 'Agent任务进度（示例）' },
  { label: 'User', href: '/user', symbol: '♙', description: '用户中心' },
] as const;
