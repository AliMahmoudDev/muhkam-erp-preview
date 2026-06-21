/**
 * Modal — compatibility wrapper.
 *
 * Maps `Modal*` names to `Dialog*` primitives so existing code
 * that imports from this file continues to work without creating
 * a competing dialog system.
 *
 * For new code, import from `@/components/ui/dialog` directly.
 */
export {
  Dialog       as Modal,
  DialogTrigger as ModalTrigger,
  DialogClose   as ModalClose,
  DialogPortal  as ModalPortal,
  DialogOverlay as ModalOverlay,
  DialogContent as ModalContent,
  DialogHeader  as ModalHeader,
  DialogFooter  as ModalFooter,
  DialogTitle   as ModalTitle,
  DialogDescription as ModalDescription,
} from '@/components/ui/dialog';
