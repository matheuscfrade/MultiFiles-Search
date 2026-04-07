; Inno Setup Script for MultiFiles Search
#define AppName "MultiFiles Search"
#define AppVersion "1.0.0"
#define AppPublisher "Matheus Frade"
#define AppURL "https://github.com/matheuscfrade/MultiFiles-Search"
#define AppExeName "MultiFileSearch.exe"

[Setup]
AppId={{C88487E1-D376-4832-B34B-6D63A6EB6CA2}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppCopyright=2024 {#AppPublisher}
DefaultDirName={autopf}\{#AppName}
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=Setup_MultiFilesSearch
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "installocr"; Description: "Instalar Tesseract OCR (Necessário para leitura de imagens e PDFs digitalizados)"; GroupDescription: "Componentes Adicionais:"; Flags: checkedonce

[Files]
Source: "dist\{#AppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "static\*"; DestDir: "{app}\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "prerequisites\tesseract-setup.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
; Executa o instalador do Tesseract se a task estiver marcada
Filename: "{tmp}\tesseract-setup.exe"; Description: "Instalando Tesseract OCR (Lembre-se de selecionar 'Portuguese' na lista de idiomas durante a instalação)"; StatusMsg: "Iniciando instalador do Tesseract..."; Tasks: installocr; Flags: waituntilterminated
; Executa o app após o término
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(AppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if (CurPageID = wpReady) and IsTaskSelected('installocr') then
  begin
    MsgBox('Importante: Durante a instalação do Tesseract OCR que será aberta a seguir, certifique-se de marcar a opção "Portuguese" na lista de linguagens (Additional Language Data) para garantir a leitura correta de documentos em português.', mbInformation, MB_OK);
  end;
end;
