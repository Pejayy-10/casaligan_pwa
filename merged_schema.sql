-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.addresses (
  address_id integer NOT NULL DEFAULT nextval('addresses_address_id_seq'::regclass),
  user_id integer UNIQUE,
  subdivision character varying,
  zip_code character varying,
  is_current character varying DEFAULT 'true'::character varying,
  region_code character varying,
  region_name character varying,
  province_code character varying,
  province_name character varying,
  city_code character varying,
  city_name character varying,
  barangay_code character varying,
  barangay_name character varying,
  street_address character varying,
  CONSTRAINT addresses_pkey PRIMARY KEY (address_id),
  CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.admins (
  admin_id integer NOT NULL DEFAULT nextval('admins_admin_id_seq'::regclass),
  user_id integer NOT NULL UNIQUE,
  admin_actions character varying,
  CONSTRAINT admins_pkey PRIMARY KEY (admin_id),
  CONSTRAINT admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.bookings (
  booking_id integer NOT NULL DEFAULT nextval('bookings_booking_id_seq'::regclass),
  schedule_id integer NOT NULL UNIQUE,
  status USER-DEFINED NOT NULL,
  booking_date timestamp with time zone DEFAULT now(),
  notes text,
  CONSTRAINT bookings_pkey PRIMARY KEY (booking_id),
  CONSTRAINT bookings_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.schedules(schedule_id)
);
CREATE TABLE public.certifications (
  certification_id integer NOT NULL DEFAULT nextval('certifications_certification_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  CONSTRAINT certifications_pkey PRIMARY KEY (certification_id)
);
CREATE TABLE public.contracts (
  contract_id integer NOT NULL DEFAULT nextval('contracts_contract_id_seq'::regclass),
  post_id integer,
  booking_id integer UNIQUE,
  worker_id integer NOT NULL,
  employer_id integer NOT NULL,
  terms text,
  contract_terms text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::contract_status,
  worker_accepted integer DEFAULT 0,
  employer_accepted integer DEFAULT 0,
  completion_proof_url character varying,
  completion_notes text,
  completed_at timestamp with time zone,
  payment_proof_url character varying,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT contracts_pkey PRIMARY KEY (contract_id),
  CONSTRAINT contracts_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forumposts(post_id),
  CONSTRAINT contracts_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id),
  CONSTRAINT contracts_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id),
  CONSTRAINT contracts_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employers(employer_id)
);
CREATE TABLE public.conversation_participants (
  conversation_id integer NOT NULL,
  user_id integer NOT NULL,
  joined_at timestamp with time zone DEFAULT now(),
  role USER-DEFINED,
  CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(conversation_id),
  CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.conversations (
  conversation_id integer NOT NULL DEFAULT nextval('conversations_conversation_id_seq'::regclass),
  job_id integer,
  hire_id integer,
  participant_ids ARRAY NOT NULL,
  title character varying,
  topic character varying,
  status USER-DEFINED NOT NULL DEFAULT 'active'::convo_status,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_message_at timestamp with time zone,
  last_message text,
  archived_at timestamp with time zone,
  deleted_at timestamp with time zone,
  restricted_at timestamp with time zone,
  restricted_by_admin_id integer,
  restriction_reason text,
  CONSTRAINT conversations_pkey PRIMARY KEY (conversation_id),
  CONSTRAINT conversations_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.forumposts(post_id),
  CONSTRAINT conversations_hire_id_fkey FOREIGN KEY (hire_id) REFERENCES public.direct_hires(hire_id),
  CONSTRAINT conversations_restricted_by_admin_id_fkey FOREIGN KEY (restricted_by_admin_id) REFERENCES public.admins(admin_id)
);
CREATE TABLE public.direct_hires (
  hire_id integer NOT NULL DEFAULT nextval('direct_hires_hire_id_seq'::regclass),
  employer_id integer NOT NULL,
  worker_id integer NOT NULL,
  package_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time character varying,
  address_street character varying,
  address_barangay character varying,
  address_city character varying,
  address_province character varying,
  address_region character varying,
  special_instructions text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::direct_hire_status,
  completion_proof_url character varying,
  completion_notes text,
  completed_at timestamp with time zone,
  payment_method character varying,
  payment_proof_url character varying,
  reference_number character varying,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  is_recurring boolean NOT NULL DEFAULT false,
  day_of_week character varying,
  start_time character varying,
  end_time character varying,
  frequency character varying,
  recurring_status character varying DEFAULT 'active'::character varying,
  recurring_cancelled_at timestamp with time zone,
  recurring_cancellation_reason text,
  cancelled_by character varying,
  CONSTRAINT direct_hires_pkey PRIMARY KEY (hire_id),
  CONSTRAINT direct_hires_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employers(employer_id),
  CONSTRAINT direct_hires_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id)
);
CREATE TABLE public.employer_languages (
  employer_id integer NOT NULL,
  language_id integer NOT NULL,
  CONSTRAINT employer_languages_pkey PRIMARY KEY (employer_id, language_id),
  CONSTRAINT employer_languages_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employers(employer_id),
  CONSTRAINT employer_languages_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.languages(language_id)
);
CREATE TABLE public.employers (
  employer_id integer NOT NULL DEFAULT nextval('employers_employer_id_seq'::regclass),
  user_id integer NOT NULL UNIQUE,
  household_size integer,
  number_of_children integer,
  residence_type character varying,
  preferences text,
  bio text,
  religion_id integer,
  CONSTRAINT employers_pkey PRIMARY KEY (employer_id),
  CONSTRAINT employers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT employers_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religions(religion_id)
);
CREATE TABLE public.favorites_workers (
  employer_id integer NOT NULL,
  worker_id integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT favorites_workers_pkey PRIMARY KEY (employer_id, worker_id),
  CONSTRAINT favorites_workers_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employers(employer_id),
  CONSTRAINT favorites_workers_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id)
);
CREATE TABLE public.forumposts (
  post_id integer NOT NULL DEFAULT nextval('forumposts_post_id_seq'::regclass),
  user_id integer NOT NULL,
  employer_id integer NOT NULL,
  title character varying NOT NULL,
  content text,
  description text,
  category character varying,
  location character varying,
  job_type USER-DEFINED,
  salary numeric,
  status USER-DEFINED NOT NULL DEFAULT 'open'::forumpost_status,
  is_longterm boolean DEFAULT false,
  start_date character varying,
  end_date character varying,
  payment_frequency character varying,
  payment_amount numeric,
  payment_schedule text,
  completion_proof_url character varying,
  completion_notes text,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  is_recurring boolean NOT NULL DEFAULT false,
  day_of_week character varying,
  start_time character varying,
  end_time character varying,
  frequency character varying,
  recurring_status character varying DEFAULT 'active'::character varying,
  recurring_cancelled_at timestamp with time zone,
  recurring_cancellation_reason text,
  cancelled_by character varying,
  category_id integer,
  CONSTRAINT forumposts_pkey PRIMARY KEY (post_id),
  CONSTRAINT forumposts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.package_categories(category_id),
  CONSTRAINT forumposts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT forumposts_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employers(employer_id)
);
CREATE TABLE public.forumreplies (
  replies_id integer NOT NULL DEFAULT nextval('forumreplies_replies_id_seq'::regclass),
  post_id integer NOT NULL,
  user_id integer NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT forumreplies_pkey PRIMARY KEY (replies_id),
  CONSTRAINT forumreplies_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forumposts(post_id),
  CONSTRAINT forumreplies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.housekeeper_applications (
  application_id integer NOT NULL DEFAULT nextval('housekeeper_applications_application_id_seq'::regclass),
  user_id integer NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::application_status,
  notes text,
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  admin_notes text,
  CONSTRAINT housekeeper_applications_pkey PRIMARY KEY (application_id),
  CONSTRAINT housekeeper_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.interestcheck (
  interest_id integer NOT NULL DEFAULT nextval('interestcheck_interest_id_seq'::regclass),
  post_id integer NOT NULL,
  worker_id integer NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::interest_status,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT interestcheck_pkey PRIMARY KEY (interest_id),
  CONSTRAINT interestcheck_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forumposts(post_id),
  CONSTRAINT interestcheck_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id)
);
CREATE TABLE public.languages (
  language_id integer NOT NULL DEFAULT nextval('languages_language_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  CONSTRAINT languages_pkey PRIMARY KEY (language_id)
);
CREATE TABLE public.matching_records (
  match_id integer NOT NULL DEFAULT nextval('matching_records_match_id_seq'::regclass),
  employer_id integer NOT NULL,
  worker_id integer NOT NULL,
  package_id integer,
  match_score numeric,
  match_date timestamp with time zone DEFAULT now(),
  status character varying NOT NULL DEFAULT 'successful'::character varying CHECK (status::text = ANY (ARRAY['successful'::character varying, 'failed'::character varying]::text[])),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT matching_records_pkey PRIMARY KEY (match_id),
  CONSTRAINT matching_records_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employers(employer_id),
  CONSTRAINT matching_records_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id),
  CONSTRAINT matching_records_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(package_id)
);
CREATE TABLE public.message_attachments (
  attachment_id integer NOT NULL DEFAULT nextval('message_attachments_attachment_id_seq'::regclass),
  message_id integer NOT NULL,
  file_path character varying NOT NULL,
  mime_type character varying,
  uploaded_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT message_attachments_pkey PRIMARY KEY (attachment_id),
  CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(message_id)
);
CREATE TABLE public.messages (
  message_id integer NOT NULL DEFAULT nextval('messages_message_id_seq'::regclass),
  conversation_id integer NOT NULL,
  sender_id integer NOT NULL,
  sender_user_id integer DEFAULT sender_id,
  content text NOT NULL,
  message_type character varying DEFAULT 'text'::character varying,
  sent_at timestamp with time zone DEFAULT now(),
  edited_at timestamp with time zone,
  read_at timestamp with time zone,
  status USER-DEFINED NOT NULL DEFAULT 'sent'::message_status,
  deleted_at timestamp with time zone,
  CONSTRAINT messages_pkey PRIMARY KEY (message_id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(conversation_id),
  CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id)
);
CREATE TABLE public.notifications (
  notification_id integer NOT NULL DEFAULT nextval('notifications_notification_id_seq'::regclass),
  user_id integer NOT NULL,
  type USER-DEFINED NOT NULL,
  title character varying NOT NULL,
  message text NOT NULL,
  content character varying,
  entity_type character varying,
  entity_id integer,
  reference_type character varying,
  reference_id integer,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (notification_id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.package_categories (
  category_id integer NOT NULL DEFAULT nextval('package_categories_category_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT package_categories_pkey PRIMARY KEY (category_id)
);
CREATE TABLE public.packages (
  package_id integer NOT NULL DEFAULT nextval('packages_package_id_seq'::regclass),
  worker_id integer NOT NULL,
  title character varying NOT NULL,
  name character varying,
  description text,
  price numeric NOT NULL,
  duration_hours integer DEFAULT 2,
  services jsonb DEFAULT '[]'::jsonb,
  availability USER-DEFINED,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::package_status,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  deleted_at timestamp with time zone,
  category_id integer,
  CONSTRAINT packages_pkey PRIMARY KEY (package_id),
  CONSTRAINT packages_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.package_categories(category_id),
  CONSTRAINT packages_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id)
);
CREATE TABLE public.payment_methods (
  method_id integer NOT NULL DEFAULT nextval('payment_methods_method_id_seq'::regclass),
  provider_name character varying NOT NULL,
  details text,
  CONSTRAINT payment_methods_pkey PRIMARY KEY (method_id)
);
CREATE TABLE public.payment_schedules (
  schedule_id integer NOT NULL DEFAULT nextval('payment_schedules_schedule_id_seq'::regclass),
  contract_id integer NOT NULL,
  worker_id integer,
  worker_name character varying,
  due_date character varying NOT NULL,
  amount numeric NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::payment_status,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_schedules_pkey PRIMARY KEY (schedule_id),
  CONSTRAINT payment_schedules_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(contract_id),
  CONSTRAINT payment_schedules_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id)
);
CREATE TABLE public.payment_transactions (
  transaction_id integer NOT NULL DEFAULT nextval('payment_transactions_transaction_id_seq'::regclass),
  schedule_id integer NOT NULL UNIQUE,
  amount_paid numeric NOT NULL,
  payment_method character varying,
  payment_proof_url character varying,
  reference_number character varying,
  paid_at timestamp with time zone DEFAULT now(),
  confirmed_by_worker boolean DEFAULT false,
  confirmed_at timestamp with time zone,
  notes text,
  CONSTRAINT payment_transactions_pkey PRIMARY KEY (transaction_id),
  CONSTRAINT payment_transactions_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.payment_schedules(schedule_id)
);
CREATE TABLE public.payments (
  payment_id integer NOT NULL DEFAULT nextval('payments_payment_id_seq'::regclass),
  contract_id integer NOT NULL,
  method_id integer,
  amount numeric NOT NULL,
  status USER-DEFINED NOT NULL,
  payment_date timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (payment_id),
  CONSTRAINT payments_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(contract_id),
  CONSTRAINT payments_method_id_fkey FOREIGN KEY (method_id) REFERENCES public.payment_methods(method_id)
);
CREATE TABLE public.refunds (
  refund_id integer NOT NULL DEFAULT nextval('refunds_refund_id_seq'::regclass),
  contract_id integer NOT NULL,
  method_id integer NOT NULL,
  amount numeric NOT NULL,
  reason text,
  status USER-DEFINED NOT NULL,
  requested_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT refunds_pkey PRIMARY KEY (refund_id),
  CONSTRAINT refunds_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(contract_id),
  CONSTRAINT refunds_method_id_fkey FOREIGN KEY (method_id) REFERENCES public.payment_methods(method_id)
);
CREATE TABLE public.religions (
  religion_id integer NOT NULL DEFAULT nextval('religions_religion_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  CONSTRAINT religions_pkey PRIMARY KEY (religion_id)
);
CREATE TABLE public.reports (
  report_id integer NOT NULL DEFAULT nextval('reports_report_id_seq'::regclass),
  reporter_id integer NOT NULL,
  reporter_user_id integer DEFAULT reporter_id,
  reporter_role character varying,
  reported_user_id integer,
  post_id integer,
  report_type USER-DEFINED NOT NULL,
  title character varying NOT NULL,
  reason text NOT NULL,
  description text NOT NULL,
  evidence_urls text,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::report_status,
  admin_id integer,
  resolved_by_admin_id integer,
  admin_notes text,
  resolution text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  resolved_at timestamp with time zone,
  CONSTRAINT reports_pkey PRIMARY KEY (report_id),
  CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id),
  CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id),
  CONSTRAINT reports_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forumposts(post_id),
  CONSTRAINT reports_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.users(id),
  CONSTRAINT reports_resolved_by_admin_id_fkey FOREIGN KEY (resolved_by_admin_id) REFERENCES public.admins(admin_id)
);
CREATE TABLE public.reviews (
  review_id integer NOT NULL DEFAULT nextval('reviews_review_id_seq'::regclass),
  rating_id integer DEFAULT review_id UNIQUE,
  contract_id integer UNIQUE,
  post_id integer,
  hire_id integer,
  reviewer_user_id integer,
  rater_id integer DEFAULT reviewer_user_id,
  target_user_id integer,
  rated_user_id integer DEFAULT target_user_id,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  stars integer DEFAULT rating,
  comment text,
  review text DEFAULT comment,
  is_hidden boolean DEFAULT false,
  hidden_at timestamp with time zone,
  hidden_by_admin_id integer,
  warned_at timestamp with time zone,
  warned_by_admin_id integer,
  restricted_at timestamp with time zone,
  restricted_by_admin_id integer,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT reviews_pkey PRIMARY KEY (review_id),
  CONSTRAINT reviews_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(contract_id),
  CONSTRAINT reviews_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forumposts(post_id),
  CONSTRAINT reviews_hire_id_fkey FOREIGN KEY (hire_id) REFERENCES public.direct_hires(hire_id),
  CONSTRAINT reviews_reviewer_user_id_fkey FOREIGN KEY (reviewer_user_id) REFERENCES public.users(id),
  CONSTRAINT reviews_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id),
  CONSTRAINT reviews_hidden_by_admin_id_fkey FOREIGN KEY (hidden_by_admin_id) REFERENCES public.admins(admin_id),
  CONSTRAINT reviews_warned_by_admin_id_fkey FOREIGN KEY (warned_by_admin_id) REFERENCES public.admins(admin_id),
  CONSTRAINT reviews_restricted_by_admin_id_fkey FOREIGN KEY (restricted_by_admin_id) REFERENCES public.admins(admin_id)
);
CREATE TABLE public.schedules (
  schedule_id integer NOT NULL DEFAULT nextval('schedules_schedule_id_seq'::regclass),
  package_id integer NOT NULL,
  employer_id integer NOT NULL,
  available_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'available'::schedule_status,
  CONSTRAINT schedules_pkey PRIMARY KEY (schedule_id),
  CONSTRAINT schedules_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(package_id),
  CONSTRAINT schedules_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.employers(employer_id)
);
CREATE TABLE public.search_logs (
  search_id integer NOT NULL DEFAULT nextval('search_logs_search_id_seq'::regclass),
  user_id integer,
  query_text character varying,
  filters_json text,
  results_count integer,
  searched_at timestamp with time zone DEFAULT now(),
  CONSTRAINT search_logs_pkey PRIMARY KEY (search_id),
  CONSTRAINT search_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.skills (
  skill_id integer NOT NULL DEFAULT nextval('skills_skill_id_seq'::regclass),
  name character varying NOT NULL UNIQUE,
  CONSTRAINT skills_pkey PRIMARY KEY (skill_id)
);
CREATE TABLE public.user_documents (
  id integer NOT NULL DEFAULT nextval('user_documents_id_seq'::regclass),
  document_id integer DEFAULT id UNIQUE,
  user_id integer NOT NULL,
  document_type USER-DEFINED NOT NULL,
  file_path character varying NOT NULL,
  status character varying NOT NULL DEFAULT 'pending'::character varying,
  notes character varying,
  rejection_reason character varying,
  uploaded_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  CONSTRAINT user_documents_pkey PRIMARY KEY (id),
  CONSTRAINT user_documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
  user_id integer DEFAULT id UNIQUE,
  email character varying NOT NULL UNIQUE,
  phone_number character varying NOT NULL UNIQUE,
  password character varying,
  password_hash text NOT NULL,
  first_name character varying NOT NULL,
  middle_name character varying,
  last_name character varying NOT NULL,
  suffix character varying,
  name character varying DEFAULT 
CASE
    WHEN (suffix IS NOT NULL) THEN ((((((first_name)::text || ' '::text) || COALESCE(((middle_name)::text || ' '::text), ''::text)) || (last_name)::text) || ' '::text) || (suffix)::text)
    ELSE ((((first_name)::text || ' '::text) || COALESCE(((middle_name)::text || ' '::text), ''::text)) || (last_name)::text)
END,
  is_owner boolean NOT NULL DEFAULT true,
  is_housekeeper boolean NOT NULL DEFAULT false,
  active_role USER-DEFINED NOT NULL DEFAULT 'owner'::user_role,
  role USER-DEFINED NOT NULL DEFAULT 'employer'::user_role,
  address_id integer,
  gender USER-DEFINED,
  age integer,
  birthday date,
  profile_picture character varying,
  id_picture character varying,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::user_status,
  deleted_at timestamp with time zone,
  restriction_reason text,
  restricted_at timestamp with time zone,
  restricted_by_admin_id integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(address_id),
  CONSTRAINT users_restricted_by_admin_id_fkey FOREIGN KEY (restricted_by_admin_id) REFERENCES public.admins(admin_id)
);
CREATE TABLE public.verification_logs (
  log_id integer NOT NULL DEFAULT nextval('verification_logs_log_id_seq'::regclass),
  verification_id integer NOT NULL,
  admin_id integer,
  old_status USER-DEFINED,
  new_status USER-DEFINED NOT NULL,
  reason text,
  changed_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verification_logs_pkey PRIMARY KEY (log_id),
  CONSTRAINT verification_logs_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES public.verifications(verification_id),
  CONSTRAINT verification_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(admin_id)
);
CREATE TABLE public.verifications (
  verification_id integer NOT NULL DEFAULT nextval('verifications_verification_id_seq'::regclass),
  worker_id integer NOT NULL,
  admin_id integer,
  document_type character varying NOT NULL,
  document_number character varying,
  file_path character varying,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::verification_status,
  submitted_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  CONSTRAINT verifications_pkey PRIMARY KEY (verification_id),
  CONSTRAINT verifications_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id),
  CONSTRAINT verifications_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admins(admin_id)
);
CREATE TABLE public.worker_blocked_dates (
  blocked_date_id integer NOT NULL DEFAULT nextval('worker_blocked_dates_blocked_date_id_seq'::regclass),
  worker_id integer NOT NULL,
  blocked_date date NOT NULL,
  reason character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT worker_blocked_dates_pkey PRIMARY KEY (blocked_date_id),
  CONSTRAINT worker_blocked_dates_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id)
);
CREATE TABLE public.worker_certifications (
  worker_id integer NOT NULL,
  certification_id integer NOT NULL,
  CONSTRAINT worker_certifications_pkey PRIMARY KEY (worker_id, certification_id),
  CONSTRAINT worker_certifications_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id),
  CONSTRAINT worker_certifications_certification_id_fkey FOREIGN KEY (certification_id) REFERENCES public.certifications(certification_id)
);
CREATE TABLE public.worker_languages (
  worker_id integer NOT NULL,
  language_id integer NOT NULL,
  CONSTRAINT worker_languages_pkey PRIMARY KEY (worker_id, language_id),
  CONSTRAINT worker_languages_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id),
  CONSTRAINT worker_languages_language_id_fkey FOREIGN KEY (language_id) REFERENCES public.languages(language_id)
);
CREATE TABLE public.worker_location_preferences (
  worker_id integer NOT NULL,
  max_distance_km numeric,
  only_nearby boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT worker_location_preferences_pkey PRIMARY KEY (worker_id),
  CONSTRAINT worker_location_preferences_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id)
);
CREATE TABLE public.worker_preferred_cities (
  worker_id integer NOT NULL,
  city_id integer NOT NULL,
  CONSTRAINT worker_preferred_cities_pkey PRIMARY KEY (worker_id, city_id),
  CONSTRAINT worker_preferred_cities_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id)
);
CREATE TABLE public.worker_skills (
  worker_id integer NOT NULL,
  skill_id integer NOT NULL,
  CONSTRAINT worker_skills_pkey PRIMARY KEY (worker_id, skill_id),
  CONSTRAINT worker_skills_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(worker_id),
  CONSTRAINT worker_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(skill_id)
);
CREATE TABLE public.workers (
  worker_id integer NOT NULL DEFAULT nextval('workers_worker_id_seq'::regclass),
  user_id integer NOT NULL UNIQUE,
  years_experience integer,
  bio text,
  religion_id integer,
  CONSTRAINT workers_pkey PRIMARY KEY (worker_id),
  CONSTRAINT workers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT workers_religion_id_fkey FOREIGN KEY (religion_id) REFERENCES public.religions(religion_id)
);