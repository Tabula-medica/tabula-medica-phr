import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { useSEO } from "@/hooks/use-seo";
import {
  ClipboardList,
  Heart,
  Brain,
  Bone,
  Eye,
  Ear,
  Activity,
  Thermometer,
  Shield,
  ListTodo,
  Plus,
  X,
  Printer,
  Wind,
  Droplets,
  MessageSquare,
  Zap,
  Pill,
  Dumbbell,
  Apple,
  FlaskConical,
  Trash2,
  LucideIcon,
} from "lucide-react";

interface ROSCategory {
  label: string;
  icon: LucideIcon;
  symptoms: string[];
}

const ROS_CATEGORIES: ROSCategory[] = [
  {
    label: "Constitutional",
    icon: Thermometer,
    symptoms: ["Fever", "Chills", "Fatigue", "Unintentional weight loss", "Unintentional weight gain", "Night sweats", "Malaise"],
  },
  {
    label: "Eyes",
    icon: Eye,
    symptoms: ["Blurred vision", "Double vision", "Eye pain", "Redness", "Discharge", "Dry eyes", "Light sensitivity"],
  },
  {
    label: "Ears, Nose & Throat",
    icon: Ear,
    symptoms: ["Hearing loss", "Ringing in ears", "Ear pain", "Nasal congestion", "Nosebleeds", "Sore throat", "Difficulty swallowing", "Hoarseness"],
  },
  {
    label: "Cardiovascular",
    icon: Heart,
    symptoms: ["Chest pain", "Palpitations", "Shortness of breath with exertion", "Swelling in legs", "Lightheadedness", "Fainting"],
  },
  {
    label: "Respiratory",
    icon: Wind,
    symptoms: ["Cough", "Shortness of breath", "Wheezing", "Coughing up blood", "Sputum production"],
  },
  {
    label: "Gastrointestinal",
    icon: Activity,
    symptoms: ["Nausea", "Vomiting", "Diarrhea", "Constipation", "Abdominal pain", "Heartburn", "Blood in stool", "Loss of appetite"],
  },
  {
    label: "Genitourinary",
    icon: Droplets,
    symptoms: ["Painful urination", "Frequent urination", "Blood in urine", "Incontinence", "Urgency"],
  },
  {
    label: "Musculoskeletal",
    icon: Bone,
    symptoms: ["Joint pain", "Joint swelling", "Muscle pain", "Back pain", "Stiffness", "Limited range of motion"],
  },
  {
    label: "Skin",
    icon: Shield,
    symptoms: ["Rash", "Itching", "New or changing moles", "Dryness", "Bruising easily", "Skin discoloration", "Wounds slow to heal"],
  },
  {
    label: "Neurological",
    icon: Brain,
    symptoms: ["Headaches", "Dizziness", "Numbness", "Tingling", "Weakness", "Tremor", "Seizures", "Memory changes"],
  },
  {
    label: "Psychiatric",
    icon: MessageSquare,
    symptoms: ["Anxiety", "Depression", "Difficulty sleeping", "Mood changes", "Loss of interest", "Difficulty concentrating"],
  },
  {
    label: "Endocrine",
    icon: Zap,
    symptoms: ["Heat or cold intolerance", "Excessive thirst", "Frequent urination", "Hair loss", "Skin changes"],
  },
  {
    label: "Hematologic / Lymphatic",
    icon: Activity,
    symptoms: ["Easy bruising", "Prolonged bleeding", "Swollen lymph nodes", "History of blood clots"],
  },
  {
    label: "Allergic / Immunologic",
    icon: Shield,
    symptoms: ["Seasonal allergies", "Hives", "Frequent infections", "Drug allergies", "Food allergies"],
  },
];

interface TodoItem {
  id: string;
  text: string;
  category: "diet" | "exercise" | "medication" | "test";
  completed: boolean;
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  diet: { label: "Diet", icon: Apple, color: "text-green-600 dark:text-green-400" },
  exercise: { label: "Exercise", icon: Dumbbell, color: "text-blue-600 dark:text-blue-400" },
  medication: { label: "Medication", icon: Pill, color: "text-purple-600 dark:text-purple-400" },
  test: { label: "Test / Lab", icon: FlaskConical, color: "text-amber-600 dark:text-amber-400" },
};

function PreVisitTab() {
  const [checkedSymptoms, setCheckedSymptoms] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});

  const toggleSymptom = (key: string) => {
    const next = new Set(checkedSymptoms);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCheckedSymptoms(next);
  };

  const totalSymptoms = ROS_CATEGORIES.reduce((acc, cat) => acc + cat.symptoms.length, 0);
  const checkedCount = checkedSymptoms.size;

  const handlePrint = () => window.print();

  const handleReset = () => {
    setCheckedSymptoms(new Set());
    setNotes({});
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Check any symptoms you're currently experiencing to share with your provider.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-previsit">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset} data-testid="button-reset-previsit">
            <Trash2 className="h-4 w-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Symptoms Checked</span>
            <span className="text-sm text-muted-foreground">{checkedCount} of {totalSymptoms}</span>
          </div>
          <Progress value={totalSymptoms > 0 ? (checkedCount / totalSymptoms) * 100 : 0} className="h-2" />
        </CardContent>
      </Card>

      <Accordion type="multiple" className="w-full">
        {ROS_CATEGORIES.map((category, catIdx) => {
          const IconComp = category.icon;
          const catChecked = category.symptoms.filter((_, sIdx) => checkedSymptoms.has(`${catIdx}-${sIdx}`)).length;
          return (
            <AccordionItem key={catIdx} value={`cat-${catIdx}`}>
              <AccordionTrigger className="hover:no-underline" data-testid={`accordion-ros-${catIdx}`}>
                <div className="flex items-center gap-2 flex-1">
                  <IconComp className="h-4 w-4 text-primary" />
                  <span>{category.label}</span>
                  {catChecked > 0 && (
                    <span className="ml-auto mr-4 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {catChecked} checked
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pl-6">
                  {category.symptoms.map((symptom, sIdx) => {
                    const key = `${catIdx}-${sIdx}`;
                    return (
                      <div key={key} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 transition-colors">
                        <Checkbox
                          id={`sym-${key}`}
                          checked={checkedSymptoms.has(key)}
                          onCheckedChange={() => toggleSymptom(key)}
                          data-testid={`checkbox-symptom-${key}`}
                        />
                        <Label
                          htmlFor={`sym-${key}`}
                          className={`text-sm cursor-pointer ${checkedSymptoms.has(key) ? "font-medium text-primary" : ""}`}
                        >
                          {symptom}
                        </Label>
                      </div>
                    );
                  })}
                  <div className="pt-2">
                    <Label htmlFor={`notes-${catIdx}`} className="text-xs text-muted-foreground">
                      Additional notes for {category.label.toLowerCase()}
                    </Label>
                    <Input
                      id={`notes-${catIdx}`}
                      placeholder="Any details to share with your provider..."
                      value={notes[`cat-${catIdx}`] || ""}
                      onChange={(e) => setNotes({ ...notes, [`cat-${catIdx}`]: e.target.value })}
                      className="mt-1"
                      data-testid={`input-notes-${catIdx}`}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function PostVisitTab() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState("");
  const [newTodoCategory, setNewTodoCategory] = useState<TodoItem["category"]>("diet");

  const addTodo = () => {
    if (!newTodoText.trim()) return;
    setTodos([
      ...todos,
      {
        id: `todo-${Date.now()}`,
        text: newTodoText.trim(),
        category: newTodoCategory,
        completed: false,
      },
    ]);
    setNewTodoText("");
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const removeTodo = (id: string) => {
    setTodos(todos.filter((t) => t.id !== id));
  };

  const completedCount = todos.filter((t) => t.completed).length;

  const categories: TodoItem["category"][] = ["diet", "exercise", "medication", "test"];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Keep track of what your provider recommended — diet changes, exercises, medications, and tests.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a To-Do</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const IconComp = cfg.icon;
              return (
                <Button
                  key={cat}
                  variant={newTodoCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewTodoCategory(cat)}
                  data-testid={`button-category-${cat}`}
                >
                  <IconComp className="h-4 w-4 mr-1.5" />
                  {cfg.label}
                </Button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={`e.g., ${newTodoCategory === "diet" ? "Reduce sodium intake" : newTodoCategory === "exercise" ? "Walk 30 min daily" : newTodoCategory === "medication" ? "Start Metformin 500mg twice daily" : "Complete CBC blood work"}`}
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              data-testid="input-add-todo"
            />
            <Button onClick={addTodo} disabled={!newTodoText.trim()} data-testid="button-add-todo">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {todos.length > 0 && (
        <>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-muted-foreground">{completedCount} of {todos.length} done</span>
              </div>
              <Progress value={(completedCount / todos.length) * 100} className="h-2" />
            </CardContent>
          </Card>

          {categories.map((cat) => {
            const items = todos.filter((t) => t.category === cat);
            if (items.length === 0) return null;
            const cfg = CATEGORY_CONFIG[cat];
            const IconComp = cfg.icon;
            return (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className={`text-base flex items-center gap-2 ${cfg.color}`}>
                    <IconComp className="h-5 w-5" />
                    {cfg.label}
                    <span className="text-xs text-muted-foreground font-normal ml-auto">
                      {items.filter((i) => i.completed).length}/{items.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {items.map((todo) => (
                    <div
                      key={todo.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${todo.completed ? "bg-muted/30 opacity-60" : "hover:bg-muted/50"}`}
                      data-testid={`todo-item-${todo.id}`}
                    >
                      <Checkbox
                        id={todo.id}
                        checked={todo.completed}
                        onCheckedChange={() => toggleTodo(todo.id)}
                        data-testid={`checkbox-todo-${todo.id}`}
                      />
                      <Label
                        htmlFor={todo.id}
                        className={`text-sm cursor-pointer flex-1 ${todo.completed ? "line-through text-muted-foreground" : ""}`}
                      >
                        {todo.text}
                      </Label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:opacity-100 hover:text-destructive"
                        onClick={() => removeTodo(todo.id)}
                        data-testid={`button-remove-${todo.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-postvisit">
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTodos([])} data-testid="button-clear-todos">
              <Trash2 className="h-4 w-4 mr-2" /> Clear All
            </Button>
          </div>
        </>
      )}

      {todos.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No to-do items yet</p>
          <p className="text-sm mt-1">Add items your provider recommended above</p>
        </div>
      )}
    </div>
  );
}

export default function VisitSummaryPage() {
  useSEO({
    title: "Visit Summary - Pre & Post Visit | Tabula Medica",
    description: "Review of systems checklist for your visit and post-visit to-do list for provider recommendations",
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <ClipboardList className="h-7 w-7 text-primary" />
            Visit Summary
          </h1>
          <p className="text-muted-foreground mt-1">Prepare for your visit and track provider recommendations</p>
        </div>

        <Tabs defaultValue="previsit" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="previsit" data-testid="tab-previsit" className="gap-2">
              <ClipboardList className="h-4 w-4" /> Pre-Visit ROS
            </TabsTrigger>
            <TabsTrigger value="postvisit" data-testid="tab-postvisit" className="gap-2">
              <ListTodo className="h-4 w-4" /> Post-Visit To-Do
            </TabsTrigger>
          </TabsList>

          <TabsContent value="previsit" className="mt-6">
            <PreVisitTab />
          </TabsContent>

          <TabsContent value="postvisit" className="mt-6">
            <PostVisitTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
