import DashboardSidebar from "@/components/DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col lg:flex-row max-w-7xl mx-auto w-full min-h-[calc(100vh-4rem)]">
      {/* Sidebar Navigation */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <div className="flex-1 w-full overflow-x-hidden">{children}</div>
    </div>
  );
}
