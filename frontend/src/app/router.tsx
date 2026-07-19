import { createBrowserRouter } from "react-router-dom";
import { OnboardingGate } from "@/features/auth/OnboardingGate";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AppLayout } from "@/shared/layout/AppLayout";

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: async () => ({ Component: (await import("@/features/auth/LoginPage")).LoginPage }),
  },
  {
    path: "/register",
    lazy: async () => ({ Component: (await import("@/features/auth/RegisterPage")).RegisterPage }),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/onboarding",
        lazy: async () => ({ Component: (await import("@/features/auth/OnboardingPage")).OnboardingPage }),
      },
      {
        element: <OnboardingGate />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                index: true,
                lazy: async () => ({ Component: (await import("@/features/dashboard/DashboardPage")).DashboardPage }),
              },
              {
                path: "vacancies",
                lazy: async () => ({ Component: (await import("@/features/vacancies/VacanciesPage")).VacanciesPage }),
              },
              {
                path: "vacancies/new",
                lazy: async () => ({ Component: (await import("@/features/vacancies/VacancyFormPage")).VacancyFormPage }),
              },
              {
                path: "vacancies/:id",
                lazy: async () => ({ Component: (await import("@/features/vacancies/VacancyDetailPage")).VacancyDetailPage }),
              },
              {
                path: "vacancies/:id/edit",
                lazy: async () => ({ Component: (await import("@/features/vacancies/VacancyFormPage")).VacancyFormPage }),
              },
              {
                path: "applications",
                lazy: async () => ({ Component: (await import("@/features/applications/ApplicationsPage")).ApplicationsPage }),
              },
              {
                path: "applications/new",
                lazy: async () => ({ Component: (await import("@/features/applications/ApplicationFormPage")).ApplicationFormPage }),
              },
              {
                path: "applications/:id",
                lazy: async () => ({ Component: (await import("@/features/applications/ApplicationDetailPage")).ApplicationDetailPage }),
              },
              {
                path: "companies",
                lazy: async () => ({ Component: (await import("@/features/companies/CompaniesPage")).CompaniesPage }),
              },
              {
                path: "companies/new",
                lazy: async () => ({ Component: (await import("@/features/companies/CompanyFormPage")).CompanyFormPage }),
              },
              {
                path: "companies/:id",
                lazy: async () => ({ Component: (await import("@/features/companies/CompanyDetailPage")).CompanyDetailPage }),
              },
              {
                path: "companies/:id/edit",
                lazy: async () => ({ Component: (await import("@/features/companies/CompanyFormPage")).CompanyFormPage }),
              },
              {
                path: "contacts",
                lazy: async () => ({ Component: (await import("@/features/contacts/ContactsPage")).ContactsPage }),
              },
              {
                path: "contacts/new",
                lazy: async () => ({ Component: (await import("@/features/contacts/ContactFormPage")).ContactFormPage }),
              },
              {
                path: "contacts/:id",
                lazy: async () => ({ Component: (await import("@/features/contacts/ContactDetailPage")).ContactDetailPage }),
              },
              {
                path: "contacts/:id/edit",
                lazy: async () => ({ Component: (await import("@/features/contacts/ContactFormPage")).ContactFormPage }),
              },
              {
                path: "cv-library",
                lazy: async () => ({ Component: (await import("@/features/cv-library/CVLibraryPage")).CVLibraryPage }),
              },
              {
                path: "cv-library/new",
                lazy: async () => ({ Component: (await import("@/features/cv-library/CVUploadPage")).CVUploadPage }),
              },
              {
                path: "interviews",
                lazy: async () => ({ Component: (await import("@/features/interviews/InterviewsPage")).InterviewsPage }),
              },
              {
                path: "interviews/new",
                lazy: async () => ({ Component: (await import("@/features/interviews/InterviewFormPage")).InterviewFormPage }),
              },
              {
                path: "tasks",
                lazy: async () => ({ Component: (await import("@/features/tasks/TasksPage")).TasksPage }),
              },
              {
                path: "analytics",
                lazy: async () => ({ Component: (await import("@/features/analytics/AnalyticsPage")).AnalyticsPage }),
              },
              {
                path: "settings",
                lazy: async () => ({ Component: (await import("@/features/settings/SettingsPage")).SettingsPage }),
              },
              {
                path: "design-system",
                lazy: async () => ({ Component: (await import("@/features/design-system/DesignSystemPage")).DesignSystemPage }),
              },
            ],
          },
        ],
      },
    ],
  },
]);
