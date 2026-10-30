!macro customInit
  ; Electron 44.10.0 still terminates with STATUS_BREAKPOINT on Windows build 26300 in the full app.
  ; Refuse installation on that build until a real smoke test passes there.
  ReadRegStr $0 HKLM64 "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentBuildNumber"
  ${If} $0 == "26300"
    MessageBox MB_ICONSTOP|MB_OK "Esta versao do Windows nao e compativel com este instalador do Machine Facturas Desktop porque o runtime incluido nao inicia. Actualize o Windows para uma versao compativel e tente novamente."
    Abort
  ${EndIf}
!macroend
