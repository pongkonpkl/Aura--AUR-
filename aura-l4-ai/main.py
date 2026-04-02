#!/usr/bin/env python3
"""
AURA L4 AI LAYER — GOVERNMENT REGULATOR MODE (final-integrated)
"""

import os
import json
import time
import uuid
import re
from typing import Any, Dict, List, Optional, Literal, Tuple

import httpx
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

# ============================================================
# 0) Config (ENV ONLY)
# ============================================================

PROJECT_ID = os.getenv("AURA_PROJECT_ID", "xjdsvbptsksjrdsredim").strip()
SERVICE_ROLE_KEY = os.getenv("AURA_SERVICE_ROLE_KEY", "sb_secret_d0Ma9T302GotEZ3wdgB-4Q_O0C4yTZu").strip()

DEV_BYPASS_ENABLED = os.getenv("AURA_DEV_BYPASS_ENABLED", "1") == "1"
BYPASS_HEADER_NAME = "x-aura-bypass"
BYPASS_HEADER_VALUE = os.getenv("AURA_BYPASS_HEADER_VALUE", "aura-dev-mode-unlocked")

SERVICE_NAME = os.getenv("SERVICE_NAME", "Aura L4 AI Regulator")
SERVICE_VERSION = os.getenv("SERVICE_VERSION", "1.0.0")
ENV = os.getenv("NODE_ENV", "dev")

_default_allow = [
    "eth_chainId",
    "eth_blockNumber",
    "eth_getBalance",
    "rpc_l4_guardian_preflight",
    "rpc_l4_audit_action",
    "rpc_submit_l3_tx"
]
RPC_ALLOWLIST = set(
    [m.strip() for m in os.getenv("RPC_ALLOWLIST", ",".join(_default_allow)).split(",") if m.strip()]
)

ROLE_PUBLIC = "PUBLIC"
ROLE_OPERATOR = "OPERATOR"
ROLE_AUDITOR = "AUDITOR"
ROLE_ADMIN = "ADMIN"

WRITE_ROLES = {ROLE_OPERATOR, ROLE_ADMIN}
APPROVE_ROLES = {ROLE_AUDITOR, ROLE_ADMIN}
READ_ROLES = {ROLE_PUBLIC, ROLE_OPERATOR, ROLE_AUDITOR, ROLE_ADMIN}

# ============================================================
# 1) App + CORS
# ============================================================

app = FastAPI(title="Aura L4 AI Nexus (Regulator Mode)", version=SERVICE_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 2) Logging
# ============================================================

def iso_now() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

def redacted_log(level: str, component: str, msg: str, trace_id: str, **fields: Any) -> None:
    event = {
        "ts": iso_now(), "level": level, "service": SERVICE_NAME, "version": SERVICE_VERSION,
        "env": ENV, "layer": "L4", "role": "GOV_REGULATOR_AI", "component": component,
        "trace_id": trace_id, "msg": msg, **fields
    }
    print(json.dumps(event, ensure_ascii=False, separators=(",", ":"), sort_keys=True))

# ============================================================
# 3) Aura RPC Client
# ============================================================

async def aura_rpc_call(method: str, params: dict, trace_id: str, bypass_header: Optional[str] = None) -> Any:
    if method not in RPC_ALLOWLIST:
        raise RuntimeError(f"RPC_NOT_ALLOWED:{method}")
    
    url = f"https://{PROJECT_ID}.supabase.co/rest/v1/rpc/{method}"
    headers = {
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        "x-trace-id": trace_id
    }
    if DEV_BYPASS_ENABLED and bypass_header == BYPASS_HEADER_VALUE:
        headers[BYPASS_HEADER_NAME] = BYPASS_HEADER_VALUE

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, headers=headers, json=params)
        if resp.status_code >= 400:
            raise RuntimeError(f"AURA_ORACLE_ERROR:{resp.status_code}:{resp.text}")
        return resp.json()

# ============================================================
# 4) Models
# ============================================================

class AIRequest(BaseModel):
    user: str
    prompt: str
    context: Dict[str, Any] = Field(default_factory=dict)

class Action(BaseModel):
    type: str = "RPC_CALL"
    rpc_method: str
    params: Dict[str, Any] = Field(default_factory=dict)
    label: str = ""
    classification: str = "READ" # READ, WRITE, AUDIT

class Plan(BaseModel):
    run_id: str
    intent: str
    actions: List[Action]
    explain: str
    risk_level: str = "LOW" # LOW, MEDIUM, HIGH
    requires_approval: bool = False

class RunRecord(BaseModel):
    run_id: str
    user: str
    prompt: str
    role: str
    status: str = "PLANNED" # PLANNED, APPROVAL_REQUIRED, APPROVED, REJECTED, EXECUTED, FAILED
    plan: Optional[Plan] = None
    approved_by: Optional[str] = None
    approved_ts: Optional[float] = None
    results: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None
    trace_id: str
    created_ts: float

RUNS: Dict[str, RunRecord] = {}

# ============================================================
# 5) AI Regulator Planner
# ============================================================

def parse_transfer(prompt: str) -> Tuple[float, str]:
    amounts = re.findall(r"(\d+\.?\d*)", prompt)
    amount_val = float(amounts[0]) if amounts else 0.0
    addresses = re.findall(r"([a-zA-Z0-9]{30,})", prompt)
    target = addresses[0] if addresses else ""
    return amount_val, target

def ai_generate_regulator_plan(user: str, prompt: str, role: str, trace_id: str) -> Plan:
    p = prompt.strip().lower()
    run_id = str(uuid.uuid4())

    # 1) Greetings
    if any(g in p for g in ["สวัสดี", "hello", "nexus", "who are you", "ใคร"]):
        return Plan(
            run_id=run_id, intent="GREETING", actions=[], risk_level="LOW", requires_approval=False,
            explain=f"สวัสดีครับคุณ {user} ผมคือ 'Aura AI Regulator' ระบบพิทักษ์และกำกับดูแลบล็อกเชนชั้น L4 ครับ"
        )

    # 2) Chain Status
    if any(kw in p for kw in ["สถานะ", "block", "height", "l3"]):
        return Plan(
            run_id=run_id, intent="READ_STATUS", risk_level="LOW", requires_approval=False,
            actions=[Action(rpc_method="eth_blockNumber", label="get_height", classification="READ")],
            explain="ผมกำลังทำการตรวจสอบความสูงของบล็อกและสถานะความเสถียรของเครือข่ายให้ครับ"
        )

    # 3) Transfer (High Risk Control)
    is_transfer = any(kw in p for kw in ["โอน", "transfer", "ส่ง", "send"])
    amount_val, target_addr = parse_transfer(prompt)

    if is_transfer and target_addr and amount_val > 0:
        risk = "HIGH" if amount_val >= 10.0 else "MEDIUM"
        return Plan(
            run_id=run_id, intent="L3_TRANSFER", risk_level=risk, requires_approval=True,
            actions=[Action(
                rpc_method="rpc_submit_l3_tx", 
                params={
                    "p_tx_type": "L3_TRANSFER", "p_from_address": user, "p_to_address": target_addr, 
                    "p_amount_atom": int(amount_val * 1e18), "p_nonce": "reg-" + str(int(time.time())), 
                    "p_public_key": "L4_REG_KEY", "p_signature": "L4_REG_SIG"
                }, 
                label="submit_l3_transfer", classification="WRITE"
            )],
            explain=f"ตรวจพบคำสั่งการเงิน ({amount_val} AUR) ตามกฎระเบียบของ Aura Regulator รายการนี้ต้องได้รับการอนุมัติก่อนดำเนินการครับ"
        )

    return Plan(
        run_id=run_id, intent="UNKNOWN", actions=[], explain="ขออภัยครับ คำสั่งไม่อยู่ในขอบเขตการกำกับดูแล รบกวนระบุเป้าหมายให้ชัดเจนครับ", 
        risk_level="LOW", requires_approval=False
    )

async def audit_event(trace_id: str, user: str, role: str, event: str, payload: dict, bypass: Optional[str]):
    try:
        await aura_rpc_call("rpc_l4_audit_action", {
            "p_guardian_name": "Aura_L4_REGULATOR", "p_user_address": user, "p_prompt": event,
            "p_intent": "AUDIT", "p_action_plan": payload, "p_trace_id": trace_id
        }, trace_id=trace_id, bypass_header=bypass)
    except: pass

# ============================================================
# 6) Routes
# ============================================================

@app.middleware("http")
async def add_trace_id(request: Request, call_next):
    request.state.trace_id = request.headers.get("x-trace-id") or str(uuid.uuid4())
    return await call_next(request)

@app.get("/health")
async def health():
    return {"status": "ok", "mode": "REGULATOR", "version": SERVICE_VERSION}

@app.post("/ai/plan")
async def ai_plan(body: AIRequest, request: Request, x_aura_bypass: Optional[str] = Header(default=None, alias=BYPASS_HEADER_NAME)):
    trace_id = request.state.trace_id
    plan = ai_generate_regulator_plan(body.user, body.prompt, "ADMIN", trace_id)
    status = "APPROVAL_REQUIRED" if plan.requires_approval else "PLANNED"
    
    run = RunRecord(run_id=plan.run_id, user=body.user, prompt=body.prompt, role="ADMIN", status=status, plan=plan, trace_id=trace_id, created_ts=time.time())
    RUNS[run.run_id] = run
    await audit_event(trace_id, body.user, "ADMIN", "PLAN_CREATED", plan.dict(), x_aura_bypass)
    return {"ok": True, "run": run.model_dump()}

@app.post("/ai/approve/{run_id}")
async def ai_approve(run_id: str, request: Request, x_aura_bypass: Optional[str] = Header(default=None, alias=BYPASS_HEADER_NAME)):
    run = RUNS.get(run_id)
    if not run: raise HTTPException(status_code=404, detail="Run not found")
    run.status = "APPROVED"
    run.approved_ts = time.time()
    await audit_event(request.state.trace_id, run.user, "ADMIN", "RUN_APPROVED", {"run_id": run_id}, x_aura_bypass)
    return {"ok": True, "run": run.model_dump()}

@app.post("/ai/execute/{run_id}")
async def ai_execute(run_id: str, request: Request, x_aura_bypass: Optional[str] = Header(default=None, alias=BYPASS_HEADER_NAME)):
    trace_id = request.state.trace_id
    run = RUNS.get(run_id)
    if not run or run.status != "APPROVED" and run.status != "PLANNED":
        raise HTTPException(status_code=400, detail="Run not ready for execution")

    # Guardian Preflight
    if run.plan.intent == "L3_TRANSFER":
        a = run.plan.actions[0]
        pre = await aura_rpc_call("rpc_l4_guardian_preflight", {
            "p_user_address": run.user, "p_target_address": a.params["p_to_address"], "p_amount_atom": a.params["p_amount_atom"]
        }, trace_id=trace_id, bypass_header=x_aura_bypass)
        if pre.get("status") == "FORBIDDEN":
            run.status = "REJECTED"
            return {"ok": False, "error": "Insufficient funds detected by Guardian"}

    results = []
    for action in run.plan.actions:
        try:
            res = await aura_rpc_call(action.rpc_method, action.params, trace_id, x_aura_bypass)
            results.append({"action": action.label, "status": "OK", "result": res})
        except Exception as e:
            results.append({"action": action.label, "status": "FAILED", "error": str(e)})

    run.status = "EXECUTED"
    run.results = results
    return {"ok": True, "run": run.model_dump(), "explanation": run.plan.explain}

@app.get("/", response_class=HTMLResponse)
async def get_ui():
    try:
        with open("nexus_ui.html", "r", encoding="utf-8") as f: return f.read()
    except: return "Aura L4 Regulator active."

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8082)
