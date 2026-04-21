import { CheckCircle } from 'lucide-react';

export default function SuccessScreen({ teamNumber, projectName }) {
  return (
    <div className="bg-white py-12 px-4 shadow sm:rounded-lg sm:px-10 text-center">
      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <h2 className="text-3xl font-extrabold text-slate-900 mb-4">
        Registration Successful!
      </h2>
      <div className="space-y-4">
        <p className="text-lg text-slate-700">
          You have been assigned
        </p>
        <p className="text-4xl font-bold text-indigo-600">
          Team {teamNumber}
        </p>
        <div className="mt-8 pt-6 border-t border-slate-200">
          <p className="text-sm text-slate-500 uppercase tracking-wide font-semibold mb-1">
            Selected Project
          </p>
          <p className="text-xl font-medium text-slate-900">
            {projectName}
          </p>
        </div>
      </div>
    </div>
  );
}
