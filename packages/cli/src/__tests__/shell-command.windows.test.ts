/**
 * Windows-specific tests for shell command construction
 * Tests cmd.exe specific behaviors: quoting, escaping, environment variables, and command chaining
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createShellCommand, getPlatformShell } from '@apexcli/core';

// Mock os.platform() to test Windows-specific behavior
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    platform: vi.fn(() => 'win32')
  };
});

describe('Windows Shell Command Construction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createShellCommand for cmd.exe', () => {
    it('produces correct Windows output for simple commands', () => {
      const result = createShellCommand(['dir']);
      expect(result).toBe('dir');

      const result2 = createShellCommand(['echo', 'hello']);
      expect(result2).toBe('echo hello');

      const result3 = createShellCommand(['type', 'file.txt']);
      expect(result3).toBe('type file.txt');
    });

    it('produces correct Windows output for commands with arguments', () => {
      const result = createShellCommand(['dir', '/b', '/s']);
      expect(result).toBe('dir /b /s');

      const result2 = createShellCommand(['copy', 'source.txt', 'dest.txt']);
      expect(result2).toBe('copy source.txt dest.txt');

      const result3 = createShellCommand(['xcopy', '/e', '/h', '/r']);
      expect(result3).toBe('xcopy /e /h /r');
    });

    it('handles Windows drive letters correctly', () => {
      const result = createShellCommand(['cd', 'C:\\Users\\test']);
      expect(result).toBe('cd C:\\Users\\test');

      const result2 = createShellCommand(['copy', 'D:\\source.txt', 'E:\\dest.txt']);
      expect(result2).toBe('copy D:\\source.txt E:\\dest.txt');

      const result3 = createShellCommand(['dir', 'C:\\Program Files']);
      expect(result3).toBe('dir "C:\\Program Files"');
    });

    it('handles UNC paths correctly', () => {
      const result = createShellCommand(['copy', '\\\\server\\share\\file.txt', 'C:\\local\\']);
      expect(result).toBe('copy \\\\server\\share\\file.txt C:\\local\\');

      const result2 = createShellCommand(['dir', '\\\\fileserver\\public']);
      expect(result2).toBe('dir \\\\fileserver\\public');

      const result3 = createShellCommand(['net', 'use', 'Z:', '\\\\server\\share']);
      expect(result3).toBe('net use Z: \\\\server\\share');
    });

    it('handles Windows paths with spaces correctly', () => {
      const result = createShellCommand(['cd', 'C:\\Program Files\\MyApp']);
      expect(result).toBe('cd "C:\\Program Files\\MyApp"');

      const result2 = createShellCommand(['dir', 'C:\\Documents and Settings']);
      expect(result2).toBe('dir "C:\\Documents and Settings"');

      const result3 = createShellCommand(['copy', 'My File.txt', 'New Folder\\']);
      expect(result3).toBe('copy "My File.txt" "New Folder\\"');
    });
  });

  describe('quote escaping for cmd.exe', () => {
    it('uses double quotes for cmd.exe quoting', () => {
      const result = createShellCommand(['echo', 'hello world']);
      expect(result).toBe('echo "hello world"');

      const result2 = createShellCommand(['dir', 'Program Files']);
      expect(result2).toBe('dir "Program Files"');
    });

    it('escapes internal quotes by doubling them', () => {
      const result = createShellCommand(['echo', 'say "hello"']);
      expect(result).toBe('echo "say ""hello"""');

      const result2 = createShellCommand(['echo', 'The "quoted" text']);
      expect(result2).toBe('echo "The ""quoted"" text"');

      const result3 = createShellCommand(['echo', '"start and end"']);
      expect(result3).toBe('echo """start and end"""');
    });

    it('handles multiple quotes correctly', () => {
      const result = createShellCommand(['echo', 'She said "Hello" and "Goodbye"']);
      expect(result).toBe('echo "She said ""Hello"" and ""Goodbye"""');

      const result2 = createShellCommand(['findstr', '"pattern"', 'file.txt']);
      expect(result2).toBe('findstr """pattern""" file.txt');
    });

    it('quotes arguments containing special cmd.exe characters', () => {
      // Test cmd.exe special characters: & | < > ^
      const result1 = createShellCommand(['echo', 'hello&world']);
      expect(result1).toBe('echo "hello&world"');

      const result2 = createShellCommand(['echo', 'hello|world']);
      expect(result2).toBe('echo "hello|world"');

      const result3 = createShellCommand(['echo', 'hello<world']);
      expect(result3).toBe('echo "hello<world"');

      const result4 = createShellCommand(['echo', 'hello>world']);
      expect(result4).toBe('echo "hello>world"');

      const result5 = createShellCommand(['echo', 'hello^world']);
      expect(result5).toBe('echo "hello^world"');
    });

    it('handles mixed special characters and quotes', () => {
      const result = createShellCommand(['echo', 'text "with quotes" & pipes']);
      expect(result).toBe('echo "text ""with quotes"" & pipes"');

      const result2 = createShellCommand(['findstr', '/c:"search term"', 'file.txt']);
      expect(result2).toBe('findstr "/c:""search term""" file.txt');
    });

    it('preserves arguments without special characters', () => {
      const result = createShellCommand(['dir', 'C:\\Windows\\System32']);
      expect(result).toBe('dir C:\\Windows\\System32');

      const result2 = createShellCommand(['copy', 'file1.txt', 'file2.txt']);
      expect(result2).toBe('copy file1.txt file2.txt');

      const result3 = createShellCommand(['echo', 'simpletext']);
      expect(result3).toBe('echo simpletext');
    });
  });

  describe('environment variable syntax', () => {
    it('preserves Windows environment variable syntax (%VAR%)', () => {
      const result = createShellCommand(['echo', '%PATH%']);
      expect(result).toBe('echo %PATH%');

      const result2 = createShellCommand(['cd', '%USERPROFILE%']);
      expect(result2).toBe('cd %USERPROFILE%');

      const result3 = createShellCommand(['set', 'MYVAR=%TEMP%\\myfile.txt']);
      expect(result3).toBe('set MYVAR=%TEMP%\\myfile.txt');
    });

    it('handles environment variables in paths with spaces', () => {
      const result = createShellCommand(['cd', '%USERPROFILE%\\My Documents']);
      expect(result).toBe('cd "%USERPROFILE%\\My Documents"');

      const result2 = createShellCommand(['dir', '%PROGRAMFILES%\\Common Files']);
      expect(result2).toBe('dir "%PROGRAMFILES%\\Common Files"');
    });

    it('preserves common Windows environment variables', () => {
      const variables = [
        '%USERPROFILE%',
        '%APPDATA%',
        '%LOCALAPPDATA%',
        '%TEMP%',
        '%TMP%',
        '%PROGRAMFILES%',
        '%PROGRAMFILES(X86)%',
        '%SYSTEMROOT%',
        '%WINDIR%',
        '%COMPUTERNAME%',
        '%USERNAME%'
      ];

      for (const envVar of variables) {
        const result = createShellCommand(['echo', envVar]);
        expect(result).toBe(`echo ${envVar}`);
      }
    });

    it('handles environment variables with special characters in values', () => {
      const result = createShellCommand(['echo', '%PATH%']);
      expect(result).toBe('echo %PATH%');

      const result2 = createShellCommand(['set', 'TEST=%TEMP%\\test file.txt']);
      expect(result2).toBe('set "TEST=%TEMP%\\test file.txt"');
    });

    it('does NOT convert Unix-style environment variables', () => {
      // Should preserve as-is in Windows context, not convert $VAR to %VAR%
      const result = createShellCommand(['echo', '$HOME']);
      expect(result).toBe('echo $HOME');

      const result2 = createShellCommand(['echo', '${USER}']);
      expect(result2).toBe('echo ${USER}');
    });
  });

  describe('command chaining operators', () => {
    it('preserves Windows command chaining with &&', () => {
      const result = createShellCommand(['echo', 'hello', '&&', 'echo', 'world']);
      expect(result).toBe('echo hello && echo world');

      const result2 = createShellCommand(['cd', 'mydir', '&&', 'dir']);
      expect(result2).toBe('cd mydir && dir');
    });

    it('preserves Windows command chaining with ||', () => {
      const result = createShellCommand(['echo', 'hello', '||', 'echo', 'failed']);
      expect(result).toBe('echo hello || echo failed');

      const result2 = createShellCommand(['dir', 'nonexistent', '||', 'echo', 'not found']);
      expect(result2).toBe('dir nonexistent || echo "not found"');
    });

    it('preserves Windows command chaining with &', () => {
      const result = createShellCommand(['echo', 'hello', '&', 'echo', 'world']);
      expect(result).toBe('echo hello & echo world');

      const result2 = createShellCommand(['start', 'notepad', '&', 'start', 'calc']);
      expect(result2).toBe('start notepad & start calc');
    });

    it('preserves Windows pipes with |', () => {
      const result = createShellCommand(['dir', '|', 'findstr', 'txt']);
      expect(result).toBe('dir | findstr txt');

      const result2 = createShellCommand(['type', 'file.txt', '|', 'more']);
      expect(result2).toBe('type file.txt | more');
    });

    it('preserves Windows redirection operators', () => {
      const result = createShellCommand(['echo', 'hello', '>', 'output.txt']);
      expect(result).toBe('echo hello > output.txt');

      const result2 = createShellCommand(['dir', '>>', 'listing.txt']);
      expect(result2).toBe('dir >> listing.txt');

      const result3 = createShellCommand(['sort', '<', 'input.txt']);
      expect(result3).toBe('sort < input.txt');
    });

    it('handles complex command chains with mixed operators', () => {
      const result = createShellCommand([
        'echo', 'Starting...', '&&',
        'dir', '|', 'findstr', '.txt', '>', 'results.txt', '&&',
        'echo', 'Done'
      ]);
      expect(result).toBe('echo Starting... && dir | findstr .txt > results.txt && echo Done');
    });

    it('quotes arguments but preserves operators in complex chains', () => {
      const result = createShellCommand([
        'echo', 'hello world', '&&',
        'dir', '"Program Files"', '|',
        'findstr', '/i', 'microsoft'
      ]);
      expect(result).toBe('echo "hello world" && dir "Program Files" | findstr /i microsoft');
    });

    it('handles command chains with paths containing spaces', () => {
      const result = createShellCommand([
        'cd', 'C:\\Program Files\\MyApp', '&&',
        'dir', '*.exe', '>', 'C:\\Temp\\exe list.txt'
      ]);
      expect(result).toBe('cd "C:\\Program Files\\MyApp" && dir *.exe > "C:\\Temp\\exe list.txt"');
    });
  });

  describe('Windows-specific command patterns', () => {
    it('handles Windows batch file calls', () => {
      const result = createShellCommand(['call', 'setup.bat']);
      expect(result).toBe('call setup.bat');

      const result2 = createShellCommand(['call', 'C:\\Scripts\\deploy.cmd', 'arg1', 'arg2']);
      expect(result2).toBe('call C:\\Scripts\\deploy.cmd arg1 arg2');
    });

    it('handles Windows service commands', () => {
      const result = createShellCommand(['sc', 'query', 'Spooler']);
      expect(result).toBe('sc query Spooler');

      const result2 = createShellCommand(['net', 'start', 'My Service']);
      expect(result2).toBe('net start "My Service"');

      const result3 = createShellCommand(['net', 'stop', 'MyService']);
      expect(result3).toBe('net stop MyService');
    });

    it('handles Windows registry commands', () => {
      const result = createShellCommand(['reg', 'query', 'HKEY_LOCAL_MACHINE\\SOFTWARE']);
      expect(result).toBe('reg query HKEY_LOCAL_MACHINE\\SOFTWARE');

      const result2 = createShellCommand(['reg', 'add', 'HKEY_CURRENT_USER\\Software\\Test', '/v', 'Value Name', '/d', 'data']);
      expect(result2).toBe('reg add HKEY_CURRENT_USER\\Software\\Test /v "Value Name" /d data');
    });

    it('handles Windows PowerShell invocation', () => {
      const result = createShellCommand(['powershell', '-Command', 'Get-Process']);
      expect(result).toBe('powershell -Command Get-Process');

      const result2 = createShellCommand(['powershell', '-ExecutionPolicy', 'Bypass', '-File', 'C:\\Scripts\\script.ps1']);
      expect(result2).toBe('powershell -ExecutionPolicy Bypass -File C:\\Scripts\\script.ps1');
    });

    it('handles Windows file operations with special characters', () => {
      const result = createShellCommand(['copy', 'file with spaces.txt', 'destination folder\\']);
      expect(result).toBe('copy "file with spaces.txt" "destination folder\\"');

      const result2 = createShellCommand(['move', 'old&name.txt', 'new name.txt']);
      expect(result2).toBe('move "old&name.txt" "new name.txt"');

      const result3 = createShellCommand(['ren', 'file|pipe.txt', 'newname.txt']);
      expect(result3).toBe('ren "file|pipe.txt" newname.txt');
    });

    it('handles Windows network commands', () => {
      const result = createShellCommand(['net', 'use', 'Z:', '\\\\server\\share', '/user:domain\\username']);
      expect(result).toBe('net use Z: \\\\server\\share /user:domain\\username');

      const result2 = createShellCommand(['ping', '-n', '4', '192.168.1.1']);
      expect(result2).toBe('ping -n 4 192.168.1.1');

      const result3 = createShellCommand(['netsh', 'interface', 'ip', 'show', 'config']);
      expect(result3).toBe('netsh interface ip show config');
    });
  });

  describe('getPlatformShell Windows configuration', () => {
    it('returns correct Windows shell configuration', () => {
      const config = getPlatformShell();

      expect(config.shell).toBe('cmd.exe');
      expect(config.shellArgs).toEqual(['/d', '/s', '/c']);
      expect(Array.isArray(config.shellArgs)).toBe(true);
      expect(config.shellArgs.length).toBe(3);
    });

    it('has consistent configuration structure', () => {
      const config = getPlatformShell();

      expect(config).toHaveProperty('shell');
      expect(config).toHaveProperty('shellArgs');
      expect(typeof config.shell).toBe('string');
      expect(Array.isArray(config.shellArgs)).toBe(true);
      expect(config.shell.length).toBeGreaterThan(0);
      expect(config.shellArgs.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases and complex scenarios', () => {
    it('handles empty string arguments', () => {
      const result = createShellCommand(['echo', '']);
      expect(result).toBe('echo ""');

      const result2 = createShellCommand(['set', 'VAR=']);
      expect(result2).toBe('set VAR=');
    });

    it('handles arguments with only whitespace', () => {
      const result = createShellCommand(['echo', '   ']);
      expect(result).toBe('echo "   "');

      const result2 = createShellCommand(['echo', '\t\n']);
      expect(result2).toBe('echo "\t\n"');
    });

    it('handles very long commands', () => {
      const longPath = 'C:\\' + 'very_long_directory_name\\'.repeat(20) + 'file.txt';
      const result = createShellCommand(['type', longPath]);
      expect(result).toContain('type');
      expect(result).toContain(longPath);
      expect(typeof result).toBe('string');
    });

    it('handles Windows reserved device names', () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM9', 'LPT1', 'LPT2', 'LPT9'];

      for (const name of reservedNames) {
        const result = createShellCommand(['echo', `testing ${name} device`]);
        expect(result).toBe(`echo "testing ${name} device"`);
      }
    });

    it('handles mixed case drive letters and paths', () => {
      const result = createShellCommand(['dir', 'c:\\WINDOWS\\system32']);
      expect(result).toBe('dir c:\\WINDOWS\\system32');

      const result2 = createShellCommand(['cd', 'D:\\Users\\MyUser\\Documents']);
      expect(result2).toBe('cd D:\\Users\\MyUser\\Documents');
    });

    it('handles commands with parentheses (for delayed expansion)', () => {
      const result = createShellCommand(['echo', '!VAR:(old)=(new)!']);
      expect(result).toBe('echo !VAR:(old)=(new)!');

      const result2 = createShellCommand(['set', 'PATH=%PATH%;C:\\New(Path)']);
      expect(result2).toBe('set "PATH=%PATH%;C:\\New(Path)"');
    });

    it('handles commands with percent signs in non-variable context', () => {
      const result = createShellCommand(['echo', '100% complete']);
      expect(result).toBe('echo "100% complete"');

      const result2 = createShellCommand(['findstr', '%', 'file.txt']);
      expect(result2).toBe('findstr % file.txt');
    });
  });
});