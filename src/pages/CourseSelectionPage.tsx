import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronUp, CheckCircle2, Home, Upload } from 'lucide-react';
import type { Page, User, Course } from '../App';
import { ScrollArea } from '../ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { TranscriptUpload } from '../components/TranscriptUpload';

interface CourseSelectionPageProps {
  user: User;
  onNavigate: (page: Page) => void;
}

interface CourseSection {
  title: string;
  courses: Course[];
  isElective?: boolean;
  electiveNote?: string;
  maxElectives?: number;
}

// Computer Science curriculum for PMU
const getComputerScienceCourses = (): CourseSection[] => {
  return [
    {
      title: 'Preparation Program',
      courses: [
        { id: 'PRPM0011', code: 'PRPM 0011', name: 'Introductory Algebra', credits: 0, semesterHours: 4, department: 'PRPM', isPrepCourse: true },
        { id: 'PRPM0022', code: 'PRPM 0022', name: 'Pre-Calculus', credits: 0, semesterHours: 4, department: 'PRPM', isPrepCourse: true, prerequisites: ['PRPM0011'] },
      ],
    },
    {
      title: 'Core Curriculum',
      courses: [
        { id: 'ALIS1211', code: 'ALIS 1211', name: 'Introduction to Islamic Culture', credits: 2, department: 'ALIS' },
        { id: 'ALIS1212', code: 'ALIS 1212', name: 'The Social System in Islam', credits: 2, department: 'ALIS', prerequisites: ['ALIS1211'] },
        { id: 'ALIS2211', code: 'ALIS 2211', name: 'Linguistic Communication Skills', credits: 2, department: 'ALIS', prerequisites: ['ALIS1212'] },
        { id: 'ALIS2212', code: 'ALIS 2212', name: 'The Biography of Prophet Mohammad', credits: 2, department: 'ALIS', prerequisites: ['ALIS2211'] },
        { id: 'ASSE2111', code: 'ASSE 2111', name: 'Learning Outcome Assessment I', credits: 1, department: 'ASSE', requiredHours: 30 },
        { id: 'ASSE3211', code: 'ASSE 3211', name: 'Learning Outcome Assessment II', credits: 2, department: 'ASSE', prerequisites: ['ASSE2111'], requiredHours: 60 },
        { id: 'COMM1311', code: 'COMM 1311', name: 'Written Communication', credits: 3, department: 'COMM' },
        { id: 'COMM1312', code: 'COMM 1312', name: 'Writing and Research', credits: 3, department: 'COMM', prerequisites: ['COMM1311'] },
        { id: 'COMM2311', code: 'COMM 2311', name: 'Oral Communication', credits: 3, department: 'COMM', prerequisites: ['COMM1312'] },
        { id: 'COMM2312', code: 'COMM 2312', name: 'Technical and Professional Communication', credits: 3, department: 'COMM', prerequisites: ['COMM2311'] },
        { id: 'PHED1111', code: 'PHED 1111', name: 'Active Living Lifestyle', credits: 1, department: 'PHED' },
        { id: 'PHED1112', code: 'PHED 1112', name: 'Healthy Behaviors & Management', credits: 1, department: 'PHED', prerequisites: ['PHED1111'] },
        { id: 'UNIV1211', code: 'UNIV 1211', name: 'Professional Development and Competencies', credits: 2, department: 'UNIV' },
        { id: 'UNIV1212', code: 'UNIV 1212', name: 'Critical Thinking and Problem Solving', credits: 2, department: 'UNIV', prerequisites: ['UNIV1211'] },
        { id: 'UNIV1213', code: 'UNIV 1213', name: 'Leadership and Teamwork', credits: 2, department: 'UNIV', prerequisites: ['UNIV1212'] },
      ],
    },
    {
      title: 'Degree Specific Core',
      courses: [
        { id: 'ASSE4311', code: 'ASSE 4311', name: 'Learning Outcome Assessment III', credits: 3, department: 'ASSE', prerequisites: ['ASSE3211'], requiredHours: 90 },
        { id: 'MATH1422', code: 'MATH 1422', name: 'Calculus I', credits: 4, department: 'MATH', prerequisites: ['PRPM0022'] },
        { id: 'MATH1423', code: 'MATH 1423', name: 'Calculus II', credits: 4, department: 'MATH', prerequisites: ['MATH1422'] },
        { id: 'MATH1324', code: 'MATH 1324', name: 'Calculus III', credits: 3, department: 'MATH', prerequisites: ['MATH1423'] },
        { id: 'MATH3433', code: 'MATH 3433', name: 'Linear Algebra and Differential Equations', credits: 4, department: 'MATH', prerequisites: ['MATH1423'] },
        { id: 'MATH2313', code: 'MATH 2313', name: 'Probability and Statistics', credits: 3, department: 'MATH', prerequisites: ['MATH1423'] },
        { id: 'PHYS1421', code: 'PHYS 1421', name: 'Physics for Engineers I', credits: 4, department: 'PHYS', prerequisites: ['PRPM0022'] },
        { id: 'PHYS1422', code: 'PHYS 1422', name: 'Physics for Engineers II', credits: 4, department: 'PHYS', prerequisites: ['PHYS1421', 'MATH1422'] },
      ],
    },
    {
      title: 'Social Science Electives',
      isElective: true,
      electiveNote: '2 required (6 credits total)',
      maxElectives: 2,
      courses: [
        { id: 'FREN1311', code: 'FREN 1311', name: 'Introduction to French Language', credits: 3, department: 'FREN' },
        { id: 'FURS1311', code: 'FURS 1311', name: 'Introduction to Futures Skills', credits: 3, department: 'FURS' },
        { id: 'FUTR1311', code: 'FUTR 1311', name: 'Introduction to Futures Studies', credits: 3, department: 'FUTR' },
        { id: 'GEGR1311', code: 'GEGR 1311', name: 'World Regional Geography', credits: 3, department: 'GEGR' },
        { id: 'HIST1311', code: 'HIST 1311', name: 'World Civilizations', credits: 3, department: 'HIST' },
        { id: 'PSYC1311', code: 'PSYC 1311', name: 'Introduction to Psychology', credits: 3, department: 'PSYC' },
        { id: 'SERV1311', code: 'SERV 1311', name: 'Introduction to Service Learning and Volunteering', credits: 3, department: 'SERV' },
        { id: 'SPAN1311', code: 'SPAN 1311', name: 'Introduction to Spanish Language', credits: 3, department: 'SPAN' },
        { id: 'SUST1311', code: 'SUST 1311', name: 'Introduction to Sustainability', credits: 3, department: 'SUST' },
        { id: 'SYST1311', code: 'SYST 1311', name: 'Introduction to Systems Thinking', credits: 3, department: 'SYST' },
        { id: 'BSTW1311', code: 'BSTW 1311', name: 'Behavioral Sciences in 3D World', credits: 3, department: 'BSTW' },
        { id: 'DANT1311', code: 'DANT 1311', name: 'Digital Anthropology', credits: 3, department: 'DANT' },
        { id: 'ECON1311', code: 'ECON 1311', name: 'Introduction to Macroeconomics', credits: 3, department: 'ECON' },
        { id: 'ECON1312', code: 'ECON 1312', name: 'Introduction to Microeconomics', credits: 3, department: 'ECON' },
      ],
    },
    {
      title: 'Natural Science Electives',
      isElective: true,
      electiveNote: '1 required (4 credits)',
      maxElectives: 1,
      courses: [
        { id: 'BIOL1411', code: 'BIOL 1411', name: 'Introductory Biology', credits: 4, department: 'BIOL' },
        { id: 'CHEM1411', code: 'CHEM 1411', name: 'Introductory Chemistry', credits: 4, department: 'CHEM' },
        { id: 'CHEM1421', code: 'CHEM 1421', name: 'Chemistry for Engineers I', credits: 4, department: 'CHEM' },
        { id: 'CHEM1422', code: 'CHEM 1422', name: 'Chemistry for Engineers II', credits: 4, department: 'CHEM', prerequisites: ['CHEM1421'] },
        { id: 'GEOL1411', code: 'GEOL 1411', name: 'Introductory Geology', credits: 4, department: 'GEOL' },
      ],
    },
    {
      title: 'Computer Engineering & Science Core',
      courses: [
        { id: 'GEIT1411', code: 'GEIT 1411', name: 'Computer Science I', credits: 4, department: 'GEIT' },
        { id: 'GEIT1412', code: 'GEIT 1412', name: 'Computer Science II', credits: 4, department: 'GEIT', prerequisites: ['GEIT1411'] },
        { id: 'GEIT2421', code: 'GEIT 2421', name: 'Data Structures', credits: 4, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT2331', code: 'GEIT 2331', name: 'Mathematical Reasoning & Algorithmic Thinking', credits: 3, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT2291', code: 'GEIT 2291', name: 'Professional Ethics', credits: 2, department: 'GEIT' },
        { id: 'GEIT3341', code: 'GEIT 3341', name: 'Database I', credits: 3, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT3331', code: 'GEIT 3331', name: 'Computer Organization', credits: 3, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT3351', code: 'GEIT 3351', name: 'Principles of Software Engineering', credits: 3, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT4361', code: 'GEIT 4361', name: 'Internship', credits: 3, department: 'GEIT', requiredHours: 90, mustBeAlone: true },
      ],
    },
    {
      title: 'Major in Computer Science',
      courses: [
        { id: 'COSC2312', code: 'COSC 2312', name: 'Web Programming', credits: 3, department: 'COSC', prerequisites: ['GEIT1411'] },
        { id: 'COSC3332', code: 'COSC 3332', name: 'Discrete Structures & Combinatorial Analysis', credits: 3, department: 'COSC', prerequisites: ['GEIT2331'] },
        { id: 'COSC3361', code: 'COSC 3361', name: 'Computer Networks', credits: 3, department: 'COSC', prerequisites: ['MATH2313', 'GEIT2421'] },
        { id: 'COSC3351', code: 'COSC 3351', name: 'Algorithms', credits: 3, department: 'COSC', prerequisites: ['GEIT2421'] },
        { id: 'COSC3411', code: 'COSC 3411', name: 'Systems Programming', credits: 4, department: 'COSC', prerequisites: ['GEIT3331'] },
        { id: 'COSC4361', code: 'COSC 4361', name: 'Operating Systems', credits: 3, department: 'COSC', prerequisites: ['COSC3411'] },
        { id: 'COSC4461', code: 'COSC 4461', name: 'Programming Languages', credits: 4, department: 'COSC', prerequisites: ['COSC3411'] },
        { id: 'COSC4362', code: 'COSC 4362', name: 'Artificial Intelligence', credits: 3, department: 'COSC', prerequisites: ['COSC3351'] },
        { id: 'COSC4363', code: 'COSC 4363', name: 'Theory of Computation', credits: 3, department: 'COSC', prerequisites: ['COSC3351', 'MATH3433'] },
      ],
    },
    {
      title: 'Computer Science Electives',
      isElective: true,
      electiveNote: '3 required (9 credits total)',
      maxElectives: 3,
      courses: [
        { id: 'COSC3354', code: 'COSC 3354', name: 'Introduction to Cryptography', credits: 3, department: 'COSC' },
        { id: 'COSC4371', code: 'COSC 4371', name: 'Computer Graphics', credits: 3, department: 'COSC' },
        { id: 'COSC4373', code: 'COSC 4373', name: 'Computer Vision', credits: 3, department: 'COSC' },
        { id: 'COSC4393', code: 'COSC 4393', name: 'Special Topics – I', credits: 3, department: 'COSC' },
        { id: 'COSC4398', code: 'COSC 4398', name: 'Special Topics – II', credits: 3, department: 'COSC' },
        { id: 'ITAP3313', code: 'ITAP 3313', name: 'User Interface Development', credits: 3, department: 'ITAP' },
        { id: 'ITAP3371', code: 'ITAP 3371', name: 'Database II', credits: 3, department: 'ITAP', prerequisites: ['GEIT3341'] },
        { id: 'ITAP4371', code: 'ITAP 4371', name: 'e-Commerce', credits: 3, department: 'ITAP' },
      ],
    },
  ];
};

// Software Engineering curriculum for PMU
const getSoftwareEngineeringCourses = (): CourseSection[] => {
  return [
    {
      title: 'Preparation Program',
      courses: [
        { id: 'PRPM0011', code: 'PRPM 0011', name: 'Introductory Algebra', credits: 0, semesterHours: 4, department: 'PRPM', isPrepCourse: true },
        { id: 'PRPM0022', code: 'PRPM 0022', name: 'Pre-Calculus', credits: 0, semesterHours: 4, department: 'PRPM', isPrepCourse: true, prerequisites: ['PRPM0011'] },
      ],
    },
    {
      title: 'Core Curriculum',
      courses: [
        { id: 'ALIS1211', code: 'ALIS 1211', name: 'Introduction to Islamic Culture', credits: 2, department: 'ALIS' },
        { id: 'ALIS1212', code: 'ALIS 1212', name: 'The Social System in Islam', credits: 2, department: 'ALIS', prerequisites: ['ALIS1211'] },
        { id: 'ALIS2211', code: 'ALIS 2211', name: 'Linguistic Communication Skills', credits: 2, department: 'ALIS', prerequisites: ['ALIS1212'] },
        { id: 'ALIS2212', code: 'ALIS 2212', name: 'The Biography of Prophet Mohammad', credits: 2, department: 'ALIS', prerequisites: ['ALIS2211'] },
        { id: 'ASSE2111', code: 'ASSE 2111', name: 'Learning Outcome Assessment I', credits: 1, department: 'ASSE', requiredHours: 30 },
        { id: 'ASSE3211', code: 'ASSE 3211', name: 'Learning Outcome Assessment II', credits: 2, department: 'ASSE', prerequisites: ['ASSE2111'], requiredHours: 60 },
        { id: 'COMM1311', code: 'COMM 1311', name: 'Written Communication', credits: 3, department: 'COMM' },
        { id: 'COMM1312', code: 'COMM 1312', name: 'Writing and Research', credits: 3, department: 'COMM', prerequisites: ['COMM1311'] },
        { id: 'COMM2311', code: 'COMM 2311', name: 'Oral Communication', credits: 3, department: 'COMM', prerequisites: ['COMM1312'] },
        { id: 'COMM2312', code: 'COMM 2312', name: 'Technical and Professional Communication', credits: 3, department: 'COMM', prerequisites: ['COMM2311'] },
        { id: 'PHED1111', code: 'PHED 1111', name: 'Active Living Lifestyle', credits: 1, department: 'PHED' },
        { id: 'PHED1112', code: 'PHED 1112', name: 'Healthy Behaviors & Management', credits: 1, department: 'PHED', prerequisites: ['PHED1111'] },
        { id: 'UNIV1211', code: 'UNIV 1211', name: 'Professional Development and Competencies', credits: 2, department: 'UNIV' },
        { id: 'UNIV1212', code: 'UNIV 1212', name: 'Critical Thinking and Problem Solving', credits: 2, department: 'UNIV', prerequisites: ['UNIV1211'] },
        { id: 'UNIV1213', code: 'UNIV 1213', name: 'Leadership and Teamwork', credits: 2, department: 'UNIV', prerequisites: ['UNIV1212'] },
      ],
    },
    {
      title: 'Degree Specific Core',
      courses: [
        { id: 'ASSE4311', code: 'ASSE 4311', name: 'Learning Outcome Assessment III', credits: 3, department: 'ASSE', prerequisites: ['ASSE3211'], requiredHours: 90 },
        { id: 'MATH1422', code: 'MATH 1422', name: 'Calculus I', credits: 4, department: 'MATH', prerequisites: ['PRPM0022'] },
        { id: 'MATH1423', code: 'MATH 1423', name: 'Calculus II', credits: 4, department: 'MATH', prerequisites: ['MATH1422'] },
        { id: 'MATH1324', code: 'MATH 1324', name: 'Calculus III', credits: 3, department: 'MATH', prerequisites: ['MATH1423'] },
        { id: 'MATH2313', code: 'MATH 2313', name: 'Probability and Statistics', credits: 3, department: 'MATH', prerequisites: ['MATH1423'] },
        { id: 'PHYS1421', code: 'PHYS 1421', name: 'Physics for Engineers I', credits: 4, department: 'PHYS', prerequisites: ['PRPM0022'] },
        { id: 'PHYS1422', code: 'PHYS 1422', name: 'Physics for Engineers II', credits: 4, department: 'PHYS', prerequisites: ['PHYS1421', 'MATH1422'] },
      ],
    },
    {
      title: 'Social Science Electives',
      isElective: true,
      electiveNote: '2 required (6 credits total)',
      maxElectives: 2,
      courses: [
        { id: 'FREN1311', code: 'FREN 1311', name: 'Introduction to French Language', credits: 3, department: 'FREN' },
        { id: 'FURS1311', code: 'FURS 1311', name: 'Introduction to Futures Skills', credits: 3, department: 'FURS' },
        { id: 'FUTR1311', code: 'FUTR 1311', name: 'Introduction to Futures Studies', credits: 3, department: 'FUTR' },
        { id: 'GEGR1311', code: 'GEGR 1311', name: 'World Regional Geography', credits: 3, department: 'GEGR' },
        { id: 'HIST1311', code: 'HIST 1311', name: 'World Civilizations', credits: 3, department: 'HIST' },
        { id: 'PSYC1311', code: 'PSYC 1311', name: 'Introduction to Psychology', credits: 3, department: 'PSYC' },
        { id: 'SERV1311', code: 'SERV 1311', name: 'Introduction to Service Learning and Volunteering', credits: 3, department: 'SERV' },
        { id: 'SPAN1311', code: 'SPAN 1311', name: 'Introduction to Spanish Language', credits: 3, department: 'SPAN' },
        { id: 'SUST1311', code: 'SUST 1311', name: 'Introduction to Sustainability', credits: 3, department: 'SUST' },
        { id: 'SYST1311', code: 'SYST 1311', name: 'Introduction to Systems Thinking', credits: 3, department: 'SYST' },
        { id: 'BSTW1311', code: 'BSTW 1311', name: 'Behavioral Sciences in 3D World', credits: 3, department: 'BSTW' },
        { id: 'DANT1311', code: 'DANT 1311', name: 'Digital Anthropology', credits: 3, department: 'DANT' },
        { id: 'ECON1311', code: 'ECON 1311', name: 'Introduction to Macroeconomics', credits: 3, department: 'ECON' },
        { id: 'ECON1312', code: 'ECON 1312', name: 'Introduction to Microeconomics', credits: 3, department: 'ECON' },
      ],
    },
    {
      title: 'Natural Science Electives',
      isElective: true,
      electiveNote: '1 required (4 credits)',
      maxElectives: 1,
      courses: [
        { id: 'BIOL1411', code: 'BIOL 1411', name: 'Introductory Biology', credits: 4, department: 'BIOL' },
        { id: 'CHEM1411', code: 'CHEM 1411', name: 'Introductory Chemistry', credits: 4, department: 'CHEM' },
        { id: 'CHEM1421', code: 'CHEM 1421', name: 'Chemistry for Engineers I', credits: 4, department: 'CHEM' },
        { id: 'CHEM1422', code: 'CHEM 1422', name: 'Chemistry for Engineers II', credits: 4, department: 'CHEM', prerequisites: ['CHEM1421'] },
        { id: 'GEOL1411', code: 'GEOL 1411', name: 'Introductory Geology', credits: 4, department: 'GEOL' },
      ],
    },
    {
      title: 'Computer Engineering & Science Core',
      courses: [
        { id: 'GEIT1411', code: 'GEIT 1411', name: 'Computer Science I', credits: 4, department: 'GEIT' },
        { id: 'GEIT1412', code: 'GEIT 1412', name: 'Computer Science II', credits: 4, department: 'GEIT', prerequisites: ['GEIT1411'] },
        { id: 'GEIT2421', code: 'GEIT 2421', name: 'Data Structures', credits: 4, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT2331', code: 'GEIT 2331', name: 'Mathematical Reasoning & Algorithmic Thinking', credits: 3, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT2291', code: 'GEIT 2291', name: 'Professional Ethics', credits: 2, department: 'GEIT' },
        { id: 'GEIT3341', code: 'GEIT 3341', name: 'Database I', credits: 3, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT3331', code: 'GEIT 3331', name: 'Computer Organization', credits: 3, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT3351', code: 'GEIT 3351', name: 'Principles of Software Engineering', credits: 3, department: 'GEIT', prerequisites: ['GEIT1412'] },
        { id: 'GEIT4361', code: 'GEIT 4361', name: 'Internship', credits: 3, department: 'GEIT', requiredHours: 90, mustBeAlone: true },
      ],
    },
    {
      title: 'Major in Software Engineering',
      courses: [
        { id: 'SOEN2312', code: 'SOEN 2312', name: 'Web Programming', credits: 3, department: 'SOEN', prerequisites: ['GEIT1411'] },
        { id: 'SOEN2332', code: 'SOEN 2332', name: 'Discrete Structures and Combinatorial Analysis', credits: 3, department: 'SOEN', prerequisites: ['GEIT2331'] },
        { id: 'SOEN3311', code: 'SOEN 3311', name: 'Requirements Engineering', credits: 3, department: 'SOEN', prerequisites: ['GEIT3351'] },
        { id: 'SOEN3351', code: 'SOEN 3351', name: 'Algorithms', credits: 3, department: 'SOEN', prerequisites: ['GEIT2421'] },
        { id: 'SOEN4361', code: 'SOEN 4361', name: 'Operating Systems', credits: 3, department: 'SOEN', prerequisites: ['GEIT3331'] },
        { id: 'SOEN4371', code: 'SOEN 4371', name: 'E-Commerce', credits: 3, department: 'SOEN', prerequisites: ['GEIT3341'] },
        { id: 'SOEN4311', code: 'SOEN 4311', name: 'Software Architecture and Design', credits: 3, department: 'SOEN', prerequisites: ['GEIT3351'] },
        { id: 'SOEN4312', code: 'SOEN 4312', name: 'Software Testing and Quality Assurance', credits: 3, department: 'SOEN', prerequisites: ['GEIT3351'] },
        { id: 'SOEN4313', code: 'SOEN 4313', name: 'Software Project Management', credits: 3, department: 'SOEN', prerequisites: ['GEIT3351'] },
      ],
    },
    {
      title: 'Software Engineering Electives (3 credits)',
      isElective: true,
      electiveNote: '1 required (3 credits)',
      maxElectives: 1,
      courses: [
        { id: 'SOEN4321', code: 'SOEN 4321', name: 'Software Maintenance and Evolution', credits: 3, department: 'SOEN', prerequisites: ['GEIT3351'] },
        { id: 'SOEN4322', code: 'SOEN 4322', name: 'Software Security', credits: 3, department: 'SOEN', prerequisites: ['GEIT3351'] },
        { id: 'SOEN3314', code: 'SOEN 3314', name: 'Formal Methods in Software Engineering', credits: 3, department: 'SOEN', prerequisites: ['GEIT3351'] },
        { id: 'SOEN3321', code: 'SOEN 3321', name: 'Programming in UNIX Environments', credits: 3, department: 'SOEN', prerequisites: ['GEIT3331'] },
        { id: 'SOEN4316', code: 'SOEN 4316', name: 'Concurrent Programming', credits: 3, department: 'SOEN', prerequisites: ['GEIT2421'] },
        { id: 'SOEN4315', code: 'SOEN 4315', name: 'Cloud Computing', credits: 3, department: 'SOEN', prerequisites: ['GEIT3341'] },
        { id: 'SOEN3361', code: 'SOEN 3361', name: 'Computer Networks', credits: 3, department: 'SOEN', prerequisites: ['GEIT2421'] },
      ],
    },
    {
      title: 'Software Engineering Electives (4 credits)',
      isElective: true,
      electiveNote: '1 required (4 credits)',
      maxElectives: 1,
      courses: [
        { id: 'SOEN4463', code: 'SOEN 4463', name: 'Data Mining', credits: 4, department: 'SOEN', prerequisites: ['GEIT2421'] },
        { id: 'SOEN3463', code: 'SOEN 3463', name: 'Distributed Systems', credits: 4, department: 'SOEN', prerequisites: ['GEIT3331'] },
        { id: 'SOEN4461', code: 'SOEN 4461', name: 'Programming Languages', credits: 4, department: 'SOEN', prerequisites: ['GEIT2421'] },
      ],
    },
  ];
};

// Mock course data based on major
const getCoursesByMajor = (major: string): CourseSection[] => {
  if (major === 'Computer Science') {
    return getComputerScienceCourses();
  }
  
  if (major === 'Software Engineering') {
    return getSoftwareEngineeringCourses();
  }
  
  // For other majors, return a simple structure with generic courses
  const genericCourses: Course[] = [
    { id: 'GEN101', code: 'GEN 101', name: 'Introduction to Major', credits: 3, department: 'GEN' },
    { id: 'GEN102', code: 'GEN 102', name: 'Fundamentals I', credits: 3, department: 'GEN' },
    { id: 'GEN201', code: 'GEN 201', name: 'Intermediate Studies', credits: 3, department: 'GEN' },
    { id: 'GEN301', code: 'GEN 301', name: 'Advanced Topics', credits: 3, department: 'GEN' },
    { id: 'GEN401', code: 'GEN 401', name: 'Capstone Project', credits: 3, department: 'GEN' },
  ];

  return [
    {
      title: 'Major Courses',
      courses: genericCourses,
    },
  ];
};

export function CourseSelectionPage({ user, onNavigate }: CourseSelectionPageProps) {
  const courseSections = getCoursesByMajor(user.major);
  const [completedCourses, setCompletedCourses] = useState<Set<string>>(new Set());
  const [currentCourses, setCurrentCourses] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(courseSections.filter(s => !s.isElective).map(s => s.title))
  );
  const [showTranscriptUpload, setShowTranscriptUpload] = useState(false);

  // Load saved selections from sessionStorage
  useEffect(() => {
    const savedCompletedIds = JSON.parse(sessionStorage.getItem('completedCourses') || '[]');
    const savedCurrentIds = JSON.parse(sessionStorage.getItem('currentCourses') || '[]');
    
    if (savedCompletedIds.length > 0) {
      setCompletedCourses(new Set(savedCompletedIds));
    }
    if (savedCurrentIds.length > 0) {
      setCurrentCourses(new Set(savedCurrentIds));
    }
  }, []);

  const toggleCompleted = (courseId: string) => {
    const newCompleted = new Set(completedCourses);
    if (newCompleted.has(courseId)) {
      newCompleted.delete(courseId);
    } else {
      newCompleted.add(courseId);
      // Remove from current if adding to completed
      const newCurrent = new Set(currentCourses);
      newCurrent.delete(courseId);
      setCurrentCourses(newCurrent);
    }
    setCompletedCourses(newCompleted);
  };

  const toggleCurrent = (courseId: string, sectionTitle: string) => {
    const section = courseSections.find(s => s.title === sectionTitle);
    
    // If it's an elective section with limits, check the limit
    if (section?.isElective && section.maxElectives) {
      const sectionCourseIds = section.courses.map(c => c.id);
      const selectedInSection = Array.from(currentCourses).filter(id => 
        sectionCourseIds.includes(id)
      ).length;
      const completedInSection = Array.from(completedCourses).filter(id => 
        sectionCourseIds.includes(id)
      ).length;
      
      // If trying to select a new course and already at limit
      if (!currentCourses.has(courseId) && 
          selectedInSection + completedInSection >= section.maxElectives) {
        toast.error(`You can only select ${section.maxElectives} course(s) from ${sectionTitle}`);
        return;
      }
    }

    const newCurrent = new Set(currentCourses);
    if (newCurrent.has(courseId)) {
      newCurrent.delete(courseId);
    } else {
      newCurrent.add(courseId);
      // Remove from completed if adding to current
      const newCompleted = new Set(completedCourses);
      newCompleted.delete(courseId);
      setCompletedCourses(newCompleted);
    }
    setCurrentCourses(newCurrent);
  };

  const markSectionCompleted = (section: CourseSection) => {
    const newCompleted = new Set(completedCourses);
    const newCurrent = new Set(currentCourses);
    
    // If it's an elective section with limits, only mark up to the limit
    if (section.isElective && section.maxElectives) {
      const sectionCourseIds = section.courses.map(c => c.id);
      const alreadyCompleted = Array.from(completedCourses).filter(id => 
        sectionCourseIds.includes(id)
      ).length;
      
      if (alreadyCompleted >= section.maxElectives) {
        toast.info(`Already completed the required ${section.maxElectives} course(s) from ${section.title}`);
        return;
      }
      
      const needed = section.maxElectives - alreadyCompleted;
      const coursesToMark = section.courses.slice(0, needed);
      
      coursesToMark.forEach(course => {
        if (!newCompleted.has(course.id)) {
          newCompleted.add(course.id);
          newCurrent.delete(course.id);
        }
      });
      
      toast.success(`Marked ${needed} course(s) as completed from ${section.title}`);
    } else {
      // For non-elective sections, mark all
      section.courses.forEach(course => {
        newCompleted.add(course.id);
        newCurrent.delete(course.id);
      });
      toast.success(`Marked all courses as completed in ${section.title}`);
    }
    
    setCompletedCourses(newCompleted);
    setCurrentCourses(newCurrent);
  };

  const toggleSection = (sectionTitle: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionTitle)) {
      newExpanded.delete(sectionTitle);
    } else {
      newExpanded.add(sectionTitle);
    }
    setExpandedSections(newExpanded);
  };

  const handleCoursesExtracted = (extractedCourses: any[]) => {
    // Match extracted courses with curriculum courses by code
    const newCompleted = new Set(completedCourses);
    const allCourses = courseSections.flatMap(s => s.courses);
    
    let matchedCount = 0;
    extractedCourses.forEach(extractedCourse => {
      const matchingCourse = allCourses.find(
        c => c.code === extractedCourse.code || c.id === extractedCourse.id
      );
      if (matchingCourse) {
        newCompleted.add(matchingCourse.id);
        matchedCount++;
      }
    });
    
    setCompletedCourses(newCompleted);
    
    if (matchedCount > 0) {
      toast.success(`Successfully matched ${matchedCount} course(s) from your degree audit`);
    } else {
      toast.info('No matching courses found. You may need to add them manually.');
    }
  };

  const handleNext = () => {
    // Build the list of courses to show in drag-drop
    const coursesToShow: Course[] = [];
    
    courseSections.forEach(section => {
      if (section.isElective && section.maxElectives) {
        // For electives with limits, only include selected ones and create placeholders for unfulfilled
        const sectionCourseIds = section.courses.map(c => c.id);
        const completedInSection = section.courses.filter(c => completedCourses.has(c.id));
        const currentInSection = section.courses.filter(c => currentCourses.has(c.id));
        
        // Add the specific courses that are in progress
        currentInSection.forEach(course => {
          if (!completedCourses.has(course.id)) {
            coursesToShow.push(course);
          }
        });
        
        // Calculate how many more are needed
        const totalSelected = completedInSection.length + currentInSection.length;
        const stillNeeded = section.maxElectives - totalSelected;
        
        // Create placeholder courses for unfulfilled requirements
        for (let i = 0; i < stillNeeded; i++) {
          const placeholderId = `PLACEHOLDER_${section.title.replace(/\s/g, '_')}_${i}`;
          const credits = section.courses[0]?.credits || 3; // Use credit from first course in section
          
          coursesToShow.push({
            id: placeholderId,
            code: section.title,
            name: section.maxElectives === 1 
              ? `Select from ${section.title}` 
              : `Select from ${section.title} (${i + 1} of ${stillNeeded})`,
            credits: credits,
            department: 'ELECTIVE',
            isElectiveOption: true, // Mark as elective option
            electiveCategory: section.title, // Store the category name
            maxElectivesAllowed: section.maxElectives, // Store the max allowed
          });
        }
      } else {
        // For required courses, show all that aren't completed
        const requiredNotCompleted = section.courses.filter(c => 
          !completedCourses.has(c.id)
        );
        coursesToShow.push(...requiredNotCompleted);
      }
    });
    
    // Collect all completed courses with their full data
    const completedCoursesData = courseSections
      .flatMap(s => s.courses)
      .filter(c => completedCourses.has(c.id));
    
    const completedIds = Array.from(completedCourses);
    
    // Collect all available elective options (not placeholders, just the actual elective courses)
    const allElectiveOptions: Course[] = [];
    courseSections.forEach(section => {
      if (section.isElective) {
        section.courses.forEach(course => {
          allElectiveOptions.push({
            ...course,
            electiveCategory: section.title,
            maxElectivesAllowed: section.maxElectives
          });
        });
      }
    });
    
    // Store the selections
    sessionStorage.setItem('completedCourses', JSON.stringify(completedIds));
    sessionStorage.setItem('currentCourses', JSON.stringify(Array.from(currentCourses)));
    sessionStorage.setItem('allCourses', JSON.stringify(coursesToShow));
    sessionStorage.setItem('completedCoursesData', JSON.stringify(completedCoursesData));
    sessionStorage.setItem('allElectiveOptions', JSON.stringify(allElectiveOptions));
    // Store original completed IDs so we can preserve them when saving the plan
    sessionStorage.setItem('originalCompletedIds', JSON.stringify(completedIds));
    onNavigate('drag-drop-planning');
  };

  const totalCredits = courseSections.flatMap(s => s.courses).reduce((sum, c) => sum + c.credits, 0);
  const completedCredits = courseSections
    .flatMap(s => s.courses)
    .filter(c => completedCourses.has(c.id))
    .reduce((sum, c) => sum + c.credits, 0);
  const currentCredits = courseSections
    .flatMap(s => s.courses)
    .filter(c => currentCourses.has(c.id))
    .reduce((sum, c) => sum + c.credits, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-orange-50 p-4">
      <div className="container mx-auto max-w-5xl">
        <div className="flex gap-2 mb-4">
          <Button
            variant="ghost"
            onClick={() => onNavigate('plan-selection')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            variant="ghost"
            onClick={() => onNavigate('dashboard')}
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </Button>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Select Your Current Progress</CardTitle>
                <p className="text-slate-600">
                  Mark the courses you've already completed and the ones you're currently taking
                </p>
                {user.major === 'Computer Science' && (
                  <p className="text-sm text-slate-500 mt-2">
                    Total credits required: 137
                  </p>
                )}
                {user.major === 'Software Engineering' && (
                  <p className="text-sm text-slate-500 mt-2">
                    Total credits required: 133
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTranscriptUpload(true)}
                className="flex-shrink-0"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Degree Audit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {courseSections.map((section, sectionIndex) => {
                  const sectionCourseIds = section.courses.map(c => c.id);
                  const sectionCompleted = section.courses.filter(c => completedCourses.has(c.id)).length;
                  const sectionCurrent = section.courses.filter(c => currentCourses.has(c.id)).length;
                  const sectionTotal = section.courses.length;
                  const isExpanded = expandedSections.has(section.title);
                  const sectionCredits = section.courses.reduce((sum, c) => sum + c.credits, 0);

                  return (
                    <div key={section.title}>
                      {sectionIndex > 0 && <Separator className="my-4" />}
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="text-lg text-slate-900">
                                {section.title}
                              </h3>
                              <Badge variant="outline" className="text-xs">
                                {sectionCredits} credits
                              </Badge>
                              {section.isElective && section.electiveNote && (
                                <Badge variant="secondary" className="text-xs">
                                  {section.electiveNote}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                              {section.title === 'Preparation Program' ? (
                                <span className="text-xs">
                                  Optional courses (0 degree credits, but count as semester hours). Required unless exempted by exam.
                                </span>
                              ) : section.isElective && section.maxElectives ? (
                                `${sectionCompleted + sectionCurrent} of ${section.maxElectives} required selected`
                              ) : (
                                `${sectionCompleted} of ${sectionTotal} courses completed`
                              )}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {!section.isElective && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => markSectionCompleted(section)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Mark All Completed
                              </Button>
                            )}
                            
                            {section.isElective ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleSection(section.title)}
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp className="w-4 h-4 mr-1" />
                                    Hide
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="w-4 h-4 mr-1" />
                                    Show
                                  </>
                                )}
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        <Collapsible open={section.isElective ? isExpanded : true}>
                          <CollapsibleContent>
                            <div className="space-y-2 mt-2">
                              {section.courses.map((course) => {
                                const isCompleted = completedCourses.has(course.id);
                                const isCurrent = currentCourses.has(course.id);
                                
                                return (
                                  <Card key={course.id} className="p-3">
                                    <div className="flex items-start gap-4">
                                      <div className="flex flex-col gap-2 mt-1">
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            id={`completed-${course.id}`}
                                            checked={isCompleted}
                                            onCheckedChange={() => toggleCompleted(course.id)}
                                          />
                                          <label
                                            htmlFor={`completed-${course.id}`}
                                            className="text-xs cursor-pointer"
                                          >
                                            Completed
                                          </label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            id={`current-${course.id}`}
                                            checked={isCurrent}
                                            onCheckedChange={() => toggleCurrent(course.id, section.title)}
                                          />
                                          <label
                                            htmlFor={`current-${course.id}`}
                                            className="text-xs cursor-pointer"
                                          >
                                            In Progress
                                          </label>
                                        </div>
                                      </div>
                                      <div className="flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <h4 className="text-sm">{course.code}</h4>
                                              {course.isPrepCourse && (
                                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                                  PREP
                                                </Badge>
                                              )}
                                            </div>
                                            <p className="text-xs text-slate-600">{course.name}</p>
                                            {course.isPrepCourse && (
                                              <p className="text-xs text-amber-600 mt-1">
                                                Not counted toward 137 degree credits
                                              </p>
                                            )}
                                            {course.prerequisites && course.prerequisites.length > 0 && (
                                              <p className="text-xs text-slate-500 mt-1">
                                                Prerequisites: {course.prerequisites.join(', ')}
                                              </p>
                                            )}
                                            {course.requiredHours && (
                                              <p className="text-xs text-blue-600 mt-1">
                                                Requires {course.requiredHours === 30 ? 'Sophomore' : course.requiredHours === 60 ? 'Junior' : course.requiredHours === 90 ? 'Senior' : `${course.requiredHours}-hour`} standing ({course.requiredHours} hours)
                                              </p>
                                            )}
                                            {course.mustBeAlone && (
                                              <p className="text-xs text-orange-600 mt-1">
                                                Must be taken alone in a semester
                                              </p>
                                            )}
                                          </div>
                                          <Badge 
                                            variant={course.isPrepCourse ? "outline" : "secondary"} 
                                            className="text-xs"
                                          >
                                            {course.isPrepCourse 
                                              ? `${course.semesterHours}h (0cr)` 
                                              : `${course.credits} cr`}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <div className="mt-6 flex justify-between items-center">
              <div className="text-sm text-slate-600">
                <div>Completed: {completedCourses.size} courses ({completedCredits} credits)</div>
                <div>Currently Taking: {currentCourses.size} courses ({currentCredits} credits)</div>
              </div>
              <Button size="lg" onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <TranscriptUpload
        open={showTranscriptUpload}
        onClose={() => setShowTranscriptUpload(false)}
        onCoursesExtracted={handleCoursesExtracted}
      />
    </div>
  );
}