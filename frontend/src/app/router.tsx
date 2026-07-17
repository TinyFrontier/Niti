import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "@/features/auth/LoginPage";
import { RegisterPage } from "@/features/auth/RegisterPage";
import { OnboardingGate } from "@/features/auth/OnboardingGate";
import { OnboardingPage } from "@/features/auth/OnboardingPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ApplicationDetailPage } from "@/features/applications/ApplicationDetailPage";
import { ApplicationFormPage } from "@/features/applications/ApplicationFormPage";
import { ApplicationsPage } from "@/features/applications/ApplicationsPage";
import { VacanciesPage } from "@/features/vacancies/VacanciesPage";
import { VacancyDetailPage } from "@/features/vacancies/VacancyDetailPage";
import { VacancyFormPage } from "@/features/vacancies/VacancyFormPage";
import { ContactDetailPage } from "@/features/contacts/ContactDetailPage";
import { ContactFormPage } from "@/features/contacts/ContactFormPage";
import { ContactsPage } from "@/features/contacts/ContactsPage";
import { CompaniesPage } from "@/features/companies/CompaniesPage";
import { CompanyDetailPage } from "@/features/companies/CompanyDetailPage";
import { CompanyFormPage } from "@/features/companies/CompanyFormPage";
import { CVLibraryPage } from "@/features/cv-library/CVLibraryPage";
import { CVUploadPage } from "@/features/cv-library/CVUploadPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { InterviewFormPage } from "@/features/interviews/InterviewFormPage";
import { InterviewsPage } from "@/features/interviews/InterviewsPage";
import { TasksPage } from "@/features/tasks/TasksPage";
import { DesignSystemPage } from "@/features/design-system/DesignSystemPage";
import { AppLayout } from "@/shared/layout/AppLayout";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/onboarding", element: <OnboardingPage /> },
      {
        element: <OnboardingGate />,
        children: [
          {
            element: <AppLayout />,
            children: [
          { index: true, element: <DashboardPage /> },
          { path: "vacancies", element: <VacanciesPage /> },
          { path: "vacancies/new", element: <VacancyFormPage /> },
          { path: "vacancies/:id", element: <VacancyDetailPage /> },
          { path: "vacancies/:id/edit", element: <VacancyFormPage /> },
          { path: "applications", element: <ApplicationsPage /> },
          { path: "applications/new", element: <ApplicationFormPage /> },
          { path: "applications/:id", element: <ApplicationDetailPage /> },
          { path: "companies", element: <CompaniesPage /> },
          { path: "companies/new", element: <CompanyFormPage /> },
          { path: "companies/:id", element: <CompanyDetailPage /> },
          { path: "companies/:id/edit", element: <CompanyFormPage /> },
          { path: "contacts", element: <ContactsPage /> },
          { path: "contacts/new", element: <ContactFormPage /> },
          { path: "contacts/:id", element: <ContactDetailPage /> },
          { path: "contacts/:id/edit", element: <ContactFormPage /> },
          { path: "cv-library", element: <CVLibraryPage /> },
          { path: "cv-library/new", element: <CVUploadPage /> },
          { path: "interviews", element: <InterviewsPage /> },
          { path: "interviews/new", element: <InterviewFormPage /> },
          { path: "tasks", element: <TasksPage /> },
          { path: "analytics", element: <AnalyticsPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "design-system", element: <DesignSystemPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
