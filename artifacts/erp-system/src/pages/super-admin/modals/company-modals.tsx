import { type Company, type CreateResult, type ResetPassResult } from '../types';
import { ResetPasswordResultModal } from './company/ResetPasswordResultModal';
import { CreateCompanyResultModal } from './company/CreateCompanyResultModal';
import { DeleteCompanyModal } from './company/DeleteCompanyModal';

interface CoDeleteMutate {
  mutate: (args: { id: number; force?: boolean; confirm_code?: string; expected_code?: string }) => void;
  isPending: boolean;
}

interface Props {
  createResult: CreateResult | null;
  setCreateResult: (v: CreateResult | null) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  resetPassResult: ResetPassResult | null;
  setResetPassResult: (v: ResetPassResult | null) => void;
  resetPassCopied: boolean;
  setResetPassCopied: (v: boolean) => void;
  deleteTarget: Company | null;
  setDeleteTarget: (v: Company | null) => void;
  deleteStep: 'confirm' | 'code';
  setDeleteStep: (v: 'confirm' | 'code') => void;
  deleteCoErr: string;
  setDeleteCoErr: (v: string) => void;
  generatedCode: string;
  setGeneratedCode: (v: string) => void;
  enteredCode: string;
  setEnteredCode: (v: string) => void;
  coDelete: CoDeleteMutate;
}

/* Composer — wires shared modal state to presentational company modals.
   Handlers/mutations remain owned by the parent hooks; this file only
   composes display components and resets local delete-flow state. */
export function CompanyModals({
  createResult, setCreateResult, showToast,
  resetPassResult, setResetPassResult, resetPassCopied, setResetPassCopied,
  deleteTarget, setDeleteTarget, deleteStep, setDeleteStep,
  deleteCoErr, setDeleteCoErr, generatedCode, setGeneratedCode,
  enteredCode, setEnteredCode, coDelete,
}: Props) {
  const cancelDelete = () => {
    setDeleteTarget(null); setDeleteCoErr('');
    setDeleteStep('confirm'); setGeneratedCode(''); setEnteredCode('');
  };

  return (
    <>
      <ResetPasswordResultModal
        resetPassResult={resetPassResult}
        setResetPassResult={setResetPassResult}
        resetPassCopied={resetPassCopied}
        setResetPassCopied={setResetPassCopied}
      />

      <CreateCompanyResultModal
        createResult={createResult}
        setCreateResult={setCreateResult}
        showToast={showToast}
      />

      <DeleteCompanyModal
        deleteTarget={deleteTarget}
        deleteStep={deleteStep}
        deleteCoErr={deleteCoErr}
        generatedCode={generatedCode}
        enteredCode={enteredCode}
        setEnteredCode={setEnteredCode}
        coDelete={coDelete}
        cancelDelete={cancelDelete}
      />
    </>
  );
}
