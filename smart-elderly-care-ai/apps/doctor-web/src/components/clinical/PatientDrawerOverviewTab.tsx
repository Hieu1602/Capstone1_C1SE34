import React from 'react';
import {
  Droplet,
  Activity,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Utensils,
  Apple,
  Stethoscope,
  Clock,
  Edit,
  LucideIcon,
} from 'lucide-react';
import { DoctorPatientDetail } from '../../types';

interface PatientDrawerOverviewTabProps {
  patientDetail: DoctorPatientDetail;
  activeBloodType: string;
  activeBmi: string;
  activeBp: string;
  onOpenRecordModal: () => void;
}

interface VitalTileConfig {
  id: string;
  icon: LucideIcon;
  category: string;
  label: string;
  value: string;
  statusText: string;
  cardClass: string;
  iconWrapClass: string;
}

interface TagCardProps {
  icon: LucideIcon;
  iconWrapClass: string;
  title: string;
  subtitle: string;
  tags: string[];
  tagClass: string;
  emptyText: string;
}

const TagInfoCard: React.FC<TagCardProps> = ({
  icon: Icon,
  iconWrapClass,
  title,
  subtitle,
  tags,
  tagClass,
  emptyText,
}) => (
  <div className="rounded-2xl border border-slate-200/80 bg-white dark:bg-[#0F172A] dark:border-slate-800/80 p-4 shadow-2xs flex flex-col justify-between">
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${iconWrapClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-extrabold text-slate-900 dark:text-white">{title}</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">{subtitle}</p>
    </div>
    <div>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((item, i) => (
            <span key={i} className={`rounded-lg px-2.5 py-1 text-xs border ${tagClass}`}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 inline-block dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60">
          {emptyText}
        </span>
      )}
    </div>
  </div>
);

function splitTags(raw: string | undefined, pattern: RegExp): string[] {
  if (!raw) return [];
  return raw
    .split(pattern)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const PatientDrawerOverviewTab: React.FC<PatientDrawerOverviewTabProps> = ({
  patientDetail,
  activeBloodType,
  activeBmi,
  activeBp,
  onOpenRecordModal,
}) => {
  const vitalTiles: VitalTileConfig[] = [
    {
      id: 'blood-type',
      icon: Droplet,
      category: 'Hệ ABO',
      label: 'Nhóm máu',
      value: activeBloodType,
      statusText: 'Đã định nhóm',
      cardClass:
        'from-rose-50/40 to-slate-50/70 dark:from-rose-950/20 hover:border-rose-200 dark:hover:border-rose-900/50',
      iconWrapClass: 'bg-rose-100/80 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400',
    },
    {
      id: 'bmi',
      icon: Activity,
      category: 'Thể trạng',
      label: 'Chỉ số BMI',
      value: activeBmi,
      statusText: 'Bình thường (18.5 - 22.9)',
      cardClass:
        'from-teal-50/40 to-slate-50/70 dark:from-teal-950/20 hover:border-teal-200 dark:hover:border-teal-900/50',
      iconWrapClass: 'bg-teal-100/80 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400',
    },
    {
      id: 'blood-pressure',
      icon: HeartPulse,
      category: 'Huyết động',
      label: 'Huyết áp chuẩn',
      value: activeBp,
      statusText: 'mmHg (Mục tiêu)',
      cardClass:
        'from-blue-50/40 to-slate-50/70 dark:from-blue-950/20 hover:border-blue-200 dark:hover:border-blue-900/50',
      iconWrapClass: 'bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    },
  ];

  const rawDrug = patientDetail.drug_allergies?.trim() || '';
  const hasDrugAllergy =
    rawDrug.length > 0 &&
    !rawDrug.toLowerCase().includes('không') &&
    !rawDrug.toLowerCase().includes('chưa');
  const drugAllergyTags = hasDrugAllergy ? splitTags(rawDrug, /[,;\n]+/) : [];

  const hasFoodAllergy =
    Boolean(patientDetail.food_allergies) &&
    !patientDetail.food_allergies!.toLowerCase().includes('không');
  const foodAllergyTags = hasFoodAllergy ? splitTags(patientDetail.food_allergies, /[,;\n]+/) : [];
  const dietaryTags = splitTags(patientDetail.dietary_notes, /[,;]+/);

  return (
    <div className="space-y-5">
      {/* Header phân mục Thể trạng & Nút Cập nhật */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white">
            Chỉ số Thể trạng &amp; Nhân trắc học
          </h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Dữ liệu khám lâm sàng định kỳ gần nhất</p>
        </div>
        <button
          type="button"
          onClick={onOpenRecordModal}
          className="flex items-center space-x-1.5 rounded-xl bg-blue-50 border border-blue-200/70 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs cursor-pointer dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-900/50"
        >
          <Edit className="h-3.5 w-3.5" />
          <span>Cập nhật hồ sơ</span>
        </button>
      </div>

      {/* Bento-Grid Vitals & Anthropometrics (3-Column Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {vitalTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.id}
              className={`rounded-2xl border border-slate-200/70 bg-gradient-to-b dark:to-[#0F172A] dark:border-slate-800/80 p-3.5 shadow-2xs transition ${tile.cardClass}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tile.iconWrapClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {tile.category}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                {tile.label}
              </span>
              <p className="text-lg font-extrabold text-slate-900 dark:text-white mt-0.5">{tile.value}</p>
              <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{tile.statusText}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Critical Alert Banner: Dị ứng thuốc */}
      <div
        className={`rounded-2xl border p-4 transition-all ${
          hasDrugAllergy
            ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30 shadow-xs'
            : 'border-slate-200/80 bg-slate-50/70 dark:border-slate-800/80 dark:bg-[#0F172A]'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                hasDrugAllergy
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 shadow-2xs'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
              }`}
            >
              {hasDrugAllergy ? (
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div>
              <h5
                className={`text-xs font-extrabold uppercase tracking-wider ${
                  hasDrugAllergy ? 'text-rose-900 dark:text-rose-200' : 'text-slate-800 dark:text-slate-200'
                }`}
              >
                Dị ứng thuốc (Chống chỉ định lâm sàng)
              </h5>
              <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                Cảnh báo y khoa quan trọng trước khi chỉ định phác đồ điều trị
              </p>
            </div>
          </div>
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold border ${
              hasDrugAllergy
                ? 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900/60'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60'
            }`}
          >
            {hasDrugAllergy ? 'CẢNH BÁO CAO' : 'AN TOÀN'}
          </span>
        </div>

        {hasDrugAllergy ? (
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-rose-200/60 dark:border-rose-900/60">
            {drugAllergyTags.map((allergen, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 px-3 py-1.5 text-xs font-bold border border-rose-200/80 dark:border-rose-900/60 shadow-2xs"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{allergen}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Không ghi nhận tiền sử dị ứng thuốc nguy hiểm</span>
          </div>
        )}
      </div>

      {/* 2-Column Grid for Secondary Info: Dị ứng thực phẩm & Chế độ dinh dưỡng */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TagInfoCard
          icon={Utensils}
          iconWrapClass="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
          title="Dị ứng thực phẩm"
          subtitle="Thực phẩm cần kiêng khem trong bữa ăn"
          tags={foodAllergyTags}
          tagClass="bg-amber-50 font-bold text-amber-800 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60"
          emptyText="Không ghi nhận dị ứng thực phẩm"
        />

        <TagInfoCard
          icon={Apple}
          iconWrapClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
          title="Chế độ dinh dưỡng"
          subtitle="Chỉ định dinh dưỡng phòng ngừa tim mạch"
          tags={dietaryTags}
          tagClass="bg-emerald-50 font-semibold text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60"
          emptyText="Ăn giảm muối, hạn chế đường, bổ sung chất xơ"
        />
      </div>

      {/* 5. Highlighted Doctor's Note Card */}
      <div className="rounded-2xl border-y border-r border-blue-100/90 border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-50/60 via-blue-50/20 to-white dark:border-slate-800/80 dark:border-l-blue-500 dark:from-blue-950/40 dark:via-blue-950/20 dark:to-[#0F172A] p-4.5 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="text-xs font-extrabold text-blue-900 dark:text-blue-300 tracking-wide uppercase">
              Dặn dò của Bác sĩ gia đình
            </span>
          </div>
          <span className="rounded-md bg-blue-100/70 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
            LÂM SÀNG
          </span>
        </div>

        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-relaxed pl-9">
          {patientDetail.doctor_notes ||
            'Bệnh nhân tuân thủ phác đồ điều trị tốt. Duy trì vận động nhẹ nhàng và tái khám định kỳ theo đúng hẹn.'}
        </p>

        <div className="mt-3.5 flex items-center justify-between border-t border-blue-100/60 dark:border-slate-800 pt-2.5 pl-9 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Phụ trách: BS. Trần Văn Minh
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <Clock className="h-3 w-3" />
            Cập nhật hôm nay
          </span>
        </div>
      </div>
    </div>
  );
};
