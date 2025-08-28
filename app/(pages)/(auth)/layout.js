import Image from 'next/image'
import FicareLogo from '../../assets/images/ficare_logo_alleen_icoon.jpg'

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-2xl rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-8 pt-8 pb-6">
            <div className="flex justify-center mb-8">
              <Image
                src={FicareLogo}
                alt="Ficare Logo"
                width={149}
                height={32}
                className="h-8 w-auto rounded-2xl"
              />
            </div>
            {children}
          </div>
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-500 text-center">
              Veilige authenticatie door Ficare
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
