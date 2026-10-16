"""Disposable test terminal only. Payload arrives on stdin, never argv/env/files."""
import json
import os
import pty
import select
import signal
import sys
import termios
import time

payload = json.load(sys.stdin)
master, slave = pty.openpty()
import subprocess
child = subprocess.Popen(sys.argv[1:], stdin=slave, stdout=slave, stderr=slave, close_fds=True)
deadline = time.monotonic() + 45
captured = bytearray()
sent = False
try:
    while time.monotonic() < deadline:
        ready, _, _ = select.select([master], [], [], 0.1)
        if ready:
            try:
                part = os.read(master, 65536)
            except OSError:
                break
            if not part:
                break
            captured.extend(part)
            if not sent and b"Deployer private key (hidden; local memory only): " in captured:
                # Raw-mode echo is observed before the disposable bytes enter.
                assert not termios.tcgetattr(slave)[3] & termios.ECHO
                os.write(master, payload["entry"].encode())
                sent = True
        if child.poll() is not None:
            break
    else:
        child.kill()
        raise RuntimeError("disposable terminal timeout")
    code = child.wait(timeout=5)
    while select.select([master], [], [], 0)[0]:
        try:
            part = os.read(master, 65536)
        except OSError:
            break
        if not part:
            break
        captured.extend(part)
    for secret in payload.get("secrets", []):
        assert secret.encode() not in captured, "disposable secret appeared in terminal output"
    assert termios.tcgetattr(slave)[3] & termios.ECHO, "terminal echo was not restored"
    print(json.dumps({"code": code, "promptObserved": sent, "echoRestored": True, "secretAbsent": True, "output": captured.decode(errors="replace")}))
finally:
    if child.poll() is None:
        child.kill()
        child.wait()
    os.close(master)
    os.close(slave)
