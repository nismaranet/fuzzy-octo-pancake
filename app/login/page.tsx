import LoginButton from "@/components/LoginButton";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0d1117] px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-[#161b22] p-10 rounded-2xl border border-[#30363d] shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white">
            Nismara <span className="text-[#b39ddb]">Logistics</span>
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Masuk untuk mengakses dashboard driver dan statistik pengiriman.
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <LoginButton />
        </div>

        <div className="text-center text-xs text-gray-500">
          Dengan masuk, Anda menyetujui kebijakan privasi Nismara.
        </div>
      </div>
    </div>
  );
}
