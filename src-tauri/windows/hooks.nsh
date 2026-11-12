; Extra installer steps.
; Desktop shortcut (recreated on every update as well).
!macro NSIS_HOOK_POSTINSTALL
  CreateShortCut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$DESKTOP\${PRODUCTNAME}.lnk"
!macroend
