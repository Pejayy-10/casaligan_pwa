"""
Clean models v2 - Only essential models for job flow
No broken relationships, production-ready
"""
# Import User first so relationships can resolve
from app.models_v2.user import User
from app.models_v2.report import Report, ReportType, ReportStatus
from app.models_v2.package import WorkerPackage
from app.models_v2.direct_hire import DirectHire, DirectHireStatus
