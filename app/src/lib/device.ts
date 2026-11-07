// Phones and tablets (a finger, not a mouse): offer "Take photo", which opens the camera straight away.
// On computers the capture attribute does nothing, so the extra button is hidden there.
export const canTakePhoto = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
