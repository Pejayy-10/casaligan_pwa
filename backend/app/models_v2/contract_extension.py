"""Contract Extension model - Allows houseowners to propose extensions for ongoing contracts"""
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base
import enum


class ExtensionStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"

    def __str__(self):
        return self.value


class ContractExtension(Base):
    __tablename__ = "contract_extensions"

    extension_id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.contract_id"), nullable=False)
    proposed_by = Column(Integer, ForeignKey("users.id"), nullable=False)  # houseowner user_id

    proposed_end_date = Column(String, nullable=False)       # new proposed end date
    proposed_budget = Column(Numeric, nullable=True)         # new proposed budget (optional)
    reason = Column(Text, nullable=True)                     # reason for extension

    status = Column(
        SQLEnum(ExtensionStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ExtensionStatus.PENDING
    )
    responded_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    contract = relationship("Contract", backref="extensions")
    proposed_by_user = relationship("User", foreign_keys=[proposed_by])
